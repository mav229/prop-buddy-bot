import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DISCORD_API = "https://discord.com/api/v10";

function htmlResponse(html: string, status = 200): Response {
  return new Response(new TextEncoder().encode(html), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function sanitizeEnvValue(value: string | undefined | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^['\"]|['\"]$/g, "");
  if (!normalized) return null;
  if (normalized.toLowerCase() === "undefined") return null;
  if (normalized.toLowerCase() === "null") return null;
  return normalized;
}

function getDiscordBotToken(): string {
  const token = sanitizeEnvValue(Deno.env.get("DISCORD_BOT_TOKEN"));
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");
  return token.replace(/^Bot\s+/i, "").trim();
}

function getDiscordGuildId(): string {
  const guildId = sanitizeEnvValue(Deno.env.get("DISCORD_GUILD_ID"));
  if (!guildId) throw new Error("Missing DISCORD_GUILD_ID");
  return guildId;
}

// ─── HMAC-Signed State (Fix 1) ───────────────────────────────────────────────
// Uses SUPABASE_SERVICE_ROLE_KEY as HMAC secret — zero extra cost, no new env var.

async function hmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signState(payload: Record<string, unknown>): Promise<string> {
  const key = await hmacKey();
  const raw = JSON.stringify(payload);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(raw)
  );
  return btoa(
    JSON.stringify({
      p: raw,
      s: Array.from(new Uint8Array(sig)),
    })
  );
}

async function verifyState(
  state: string
): Promise<Record<string, unknown> | null> {
  try {
    const { p, s } = JSON.parse(atob(state));
    const key = await hmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(s),
      new TextEncoder().encode(p)
    );
    if (!valid) return null;
    const payload = JSON.parse(p);
    // Reject states older than 10 minutes
    if (payload.t && Date.now() - payload.t > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Role Logic ───────────────────────────────────────────────────────────────

type PlatformRole = "student" | "examinee" | "scholar";

function determineRole(
  collections: Record<string, unknown[]>
): PlatformRole {
  if ((collections["payouts"] || []).length > 0) return "scholar";
  if (
    (collections["purchases"] || []).length > 0 ||
    (collections["orders"] || []).length > 0
  )
    return "examinee";
  return "student";
}

function getRoleId(role: PlatformRole): string {
  const map: Record<PlatformRole, string> = {
    student: Deno.env.get("STUDENT_ROLE_ID") || "",
    examinee: Deno.env.get("EXAMINEE_ROLE_ID") || "",
    scholar: Deno.env.get("SCHOLAR_ROLE_ID") || "",
  };
  return map[role];
}

const ALL_ROLES: PlatformRole[] = ["student", "examinee", "scholar"];

// ─── Discord API with Rate-Limit Retry (Fix 8) ──────────────────────────────

async function discordFetch(
  url: string,
  init: RequestInit,
  retries = 1
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && retries > 0) {
    const body = await res.json().catch(() => ({}));
    const waitMs = (body.retry_after ?? 1) * 1000 + 100;
    console.warn(`Discord 429 — waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
    return discordFetch(url, init, retries - 1);
  }
  return res;
}

// ─── Role Assignment (Fix 10: skip if unchanged) ────────────────────────────

async function assignDiscordRole(
  discordUserId: string,
  newRole: PlatformRole,
  previousRole?: string | null
): Promise<void> {
  // Fix 10 — don't hit Discord API if role hasn't changed
  if (previousRole === newRole) {
    console.log(`Role unchanged (${newRole}), skipping Discord API calls`);
    return;
  }

  const botToken = getDiscordBotToken();
  const guildId = getDiscordGuildId();

  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  // Remove old roles
  for (const roleKey of ALL_ROLES) {
    if (roleKey === newRole) continue;
    const roleId = getRoleId(roleKey);
    if (!roleId) continue;
    const res = await discordFetch(
      `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      { method: "DELETE", headers }
    );
    if (!res.ok && res.status !== 404) {
      console.warn(`Failed to remove role ${roleKey}: ${res.status}`);
    }
  }

  // Add new role
  const newRoleId = getRoleId(newRole);
  if (!newRoleId) throw new Error(`No role ID for ${newRole}`);

  const addRes = await discordFetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${newRoleId}`,
    { method: "PUT", headers }
  );
  if (!addRes.ok) {
    const t = await addRes.text().catch(() => "");
    if (addRes.status === 401) {
      throw new Error(
        "Discord bot authentication failed (401). Re-save DISCORD_BOT_TOKEN without the 'Bot ' prefix."
      );
    }
    throw new Error(`Failed to assign ${newRole}: ${addRes.status} ${t}`);
  }
}

// ─── MongoDB Fetch (only purchases/orders/payouts) ──────────────────────────

async function fetchUserDataFromMongo(
  email: string
): Promise<Record<string, unknown[]>> {
  const uri = Deno.env.get("MONGO_URI");
  if (!uri) throw new Error("MONGO_URI not configured");

  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await db.collection("users").findOne({
      email: {
        $regex: new RegExp(
          `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
          "i"
        ),
      },
    });

    if (!user) return {};

    const userId = user._id;
    const userIdStr = userId.toString();
    const collections: Record<string, unknown[]> = {};

    // Only fetch role-relevant collections (Fix 9: minimal data)
    for (const colName of ["purchases", "orders", "payouts"]) {
      try {
        const docs = await db
          .collection(colName)
          .find({
            $or: [
              { userId },
              { userId: userIdStr },
              { user: userId },
              { user: userIdStr },
              { email: normalizedEmail },
              { customerEmail: normalizedEmail },
              { buyerEmail: normalizedEmail },
            ],
          })
          .limit(1) // We only need to know if ≥1 exists
          .toArray();
        if (docs.length > 0) collections[colName] = docs;
      } catch (err) {
        console.error(`Error fetching ${colName}:`, err);
      }
    }

    return collections;
  } finally {
    try {
      await client.close();
    } catch (_) {
      /* ignore */
    }
  }
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getDiscordRedirectUri(): string {
  const sanitize = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.toLowerCase() === "undefined") return null;
    if (normalized.toLowerCase() === "null") return null;
    return normalized;
  };

  const fromUriSecret = sanitize(Deno.env.get("DISCORD_REDIRECT_URI"));
  if (fromUriSecret) return fromUriSecret;

  const fromUrlSecret = sanitize(Deno.env.get("DISCORD_REDIRECT_URL"));
  if (fromUrlSecret) return fromUrlSecret;

  const supabaseUrl = sanitize(Deno.env.get("SUPABASE_URL"));
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/discord-connect`;
  }

  throw new Error(
    "Discord redirect URI is missing (set DISCORD_REDIRECT_URI or DISCORD_REDIRECT_URL)"
  );
}

// ─── Background sync (Fix 5: deferred mongo lookup during OAuth) ─────────

async function backgroundRoleSync(
  email: string,
  discordUserId: string
): Promise<void> {
  try {
    const collections = await fetchUserDataFromMongo(email);
    const role = determineRole(collections);
    const supabase = getSupabase();

    // Get current to check for change (Fix 10)
    const { data: current } = await supabase
      .from("discord_connections")
      .select("assigned_role")
      .eq("email", email)
      .maybeSingle();

    await assignDiscordRole(discordUserId, role, current?.assigned_role);

    await supabase
      .from("discord_connections")
      .update({
        assigned_role: role,
        last_role_update: new Date().toISOString(),
        needs_sync: false,
        last_synced_at: new Date().toISOString(),
      })
      .eq("email", email);

    console.log(`Background sync complete: ${email} → ${role}`);
  } catch (err) {
    console.error("Background sync failed:", err);
    // Mark needs_sync so batch worker can retry
    try {
      const supabase = getSupabase();
      await supabase
        .from("discord_connections")
        .update({ needs_sync: true })
        .eq("email", email);
    } catch (_) {
      /* ignore */
    }
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // ── POST actions ──────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const { action, email } = await req.json();

      // ── Generate OAuth URL ──
      if (action === "get_oauth_url") {
        const clientId = Deno.env.get("DISCORD_CLIENT_ID");
        if (!clientId) throw new Error("DISCORD_CLIENT_ID not configured");
        if (!email) throw new Error("Email required");

        const redirectUri = getDiscordRedirectUri();

        // Fix 1: HMAC-signed state with timestamp
        const state = await signState({
          email: email.toLowerCase().trim(),
          t: Date.now(),
        });

        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&scope=identify+guilds.join&permissions=268435600&state=${encodeURIComponent(state)}`;

        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ── Manual sync ──
      if (action === "sync") {
        if (!email) throw new Error("Email required for sync");
        const normalizedEmail = email.toLowerCase().trim();
        const supabase = getSupabase();

        const { data: conn } = await supabase
          .from("discord_connections")
          .select("*")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!conn) {
          return new Response(
            JSON.stringify({ error: "No Discord connection found" }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Re-evaluate from MongoDB
        const collections = await fetchUserDataFromMongo(normalizedEmail);
        const newRole = determineRole(collections);

        // Fix 10: skip if unchanged
        await assignDiscordRole(conn.discord_user_id, newRole, conn.assigned_role);

        await supabase
          .from("discord_connections")
          .update({
            assigned_role: newRole,
            last_role_update: new Date().toISOString(),
            needs_sync: false,
            last_synced_at: new Date().toISOString(),
          })
          .eq("email", normalizedEmail);

        return new Response(
          JSON.stringify({
            success: true,
            role: newRole,
            previous_role: conn.assigned_role,
            changed: conn.assigned_role !== newRole,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // ── Check status ──
      if (action === "status") {
        if (!email) throw new Error("Email required");
        const supabase = getSupabase();

        const { data: conn } = await supabase
          .from("discord_connections")
          .select("*")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle();

        return new Response(
          JSON.stringify({ connected: !!conn, connection: conn }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // ── Batch sync (Fix 7) ──
      if (action === "batch_sync") {
        // Secured via service role key check
        const authHeader = req.headers.get("Authorization");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!authHeader?.includes(serviceKey || "___")) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const supabase = getSupabase();
        const { data: pending } = await supabase
          .from("discord_connections")
          .select("*")
          .eq("needs_sync", true)
          .limit(50);

        let synced = 0;
        for (const conn of pending || []) {
          try {
            const collections = await fetchUserDataFromMongo(conn.email);
            const newRole = determineRole(collections);
            await assignDiscordRole(
              conn.discord_user_id,
              newRole,
              conn.assigned_role
            );
            await supabase
              .from("discord_connections")
              .update({
                assigned_role: newRole,
                last_role_update: new Date().toISOString(),
                needs_sync: false,
                last_synced_at: new Date().toISOString(),
              })
              .eq("id", conn.id);
            synced++;
          } catch (err) {
            console.error(`Batch sync failed for ${conn.email}:`, err);
          }
        }

        return new Response(
          JSON.stringify({ synced, total: (pending || []).length }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Discord connect error:", error);
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  // ── GET: OAuth Callback ───────────────────────────────────────────────────
  const hasOAuthParams =
    !!url.searchParams.get("code") && !!url.searchParams.get("state");

  // Accept both old callback=true URLs and plain OAuth callback URLs
  if (
    req.method === "GET" &&
    (url.searchParams.get("callback") === "true" || hasOAuthParams)
  ) {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      return htmlResponse("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Connection Failed</title></head><body><h1>Error: Missing code or state</h1></body></html>", 400);
    }

    try {
      // Fix 1: Verify HMAC-signed state
      const statePayload = await verifyState(stateParam);
      if (!statePayload || !statePayload.email) {
        return htmlResponse("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Connection Failed</title></head><body><h1>Error: Invalid or expired state token</h1></body></html>", 403);
      }

      const email = (statePayload.email as string).toLowerCase().trim();
      const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
      const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
      const redirectUri = getDiscordRedirectUri();

      // Exchange code for token
      const tokenRes = await fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          }),
        }
      );

      if (!tokenRes.ok) {
        const t = await tokenRes.text();
        throw new Error(`Token exchange failed: ${tokenRes.status} ${t}`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Get Discord user info
      const userRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!userRes.ok) throw new Error("Failed to fetch Discord user");
      const discordUser = await userRes.json();

      // Add user to guild
      const guildId = getDiscordGuildId();
      const botToken = getDiscordBotToken();
      const joinRes = await discordFetch(
        `${DISCORD_API}/guilds/${guildId}/members/${discordUser.id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: accessToken }),
        }
      );

      if (!joinRes.ok) {
        const t = await joinRes.text().catch(() => "");
        if (joinRes.status === 401) {
          throw new Error(
            "Discord bot authentication failed (401). Re-save DISCORD_BOT_TOKEN without the 'Bot ' prefix."
          );
        }
        throw new Error(`Failed to add member to guild: ${joinRes.status} ${t}`);
      }

      // Fix 5: Assign provisional "student" role immediately, then sync in background
      const supabase = getSupabase();

      // Check if reconnecting (Fix: on reconnect re-evaluate)
      const { data: existing } = await supabase
        .from("discord_connections")
        .select("assigned_role")
        .eq("email", email)
        .maybeSingle();

      const provisionalRole: PlatformRole = existing?.assigned_role || "student";

      // Assign provisional role immediately (fast OAuth)
      await assignDiscordRole(discordUser.id, provisionalRole, null);

      // Store connection
      await supabase.from("discord_connections").upsert(
        {
          email,
          discord_user_id: discordUser.id,
          discord_username: discordUser.username,
          discord_avatar: discordUser.avatar,
          assigned_role: provisionalRole,
          last_role_update: new Date().toISOString(),
          needs_sync: true, // marked for background sync
          last_synced_at: null,
        },
        { onConflict: "email" }
      );

      // Fix 5: Trigger background sync (non-blocking)
      // EdgeRuntime.waitUntil is available in Deno Deploy/Supabase Edge Functions
      const syncPromise = backgroundRoleSync(email, discordUser.id);
      try {
        // @ts-ignore - EdgeRuntime may not be typed
        if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(syncPromise);
        } else {
          // Fallback: just await it (still fast, ~200ms for 3 queries)
          await syncPromise;
        }
      } catch {
        await syncPromise;
      }

      const roleLabel =
        provisionalRole.charAt(0).toUpperCase() + provisionalRole.slice(1);
      const dashboardUrl =
        Deno.env.get("DASHBOARD_REDIRECT_URL") ||
        "https://prop-buddy-bot.lovable.app/fullpage";

      const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Discord Connected</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{min-height:100%}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:radial-gradient(circle at top,rgba(74,222,128,0.08),transparent 26%),linear-gradient(180deg,#050507 0%,#09090b 100%);color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;-webkit-font-smoothing:antialiased;overflow:hidden}
.shell{position:relative;width:100%;display:flex;align-items:center;justify-content:center}
.shell::before,.shell::after{content:'';position:absolute;border-radius:999px;filter:blur(80px);pointer-events:none;opacity:.5}
.shell::before{width:240px;height:240px;background:rgba(74,222,128,0.08);top:-60px;right:8%}
.shell::after{width:220px;height:220px;background:rgba(88,101,242,0.08);bottom:-80px;left:6%}
.card{background:linear-gradient(180deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.025) 100%);border:1px solid rgba(255,255,255,0.08);border-radius:28px;padding:44px 36px 32px;text-align:center;max-width:430px;width:min(100%,430px);position:relative;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.05);backdrop-filter:blur(18px);animation:cardIn .6s cubic-bezier(.16,1,.3,1) both}
.card::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% -10%,rgba(255,255,255,0.06),transparent 36%);pointer-events:none}
.shine{position:absolute;top:0;left:50%;transform:translateX(-50%);height:1px;width:62%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)}
.progress{position:absolute;bottom:0;left:0;height:2px;background:linear-gradient(90deg,#4ade80,#22c55e);animation:shrink 5s linear forwards;border-radius:0 2px 0 0}
.glow{width:78px;height:78px;margin:0 auto 22px;background:radial-gradient(circle,rgba(74,222,128,0.18) 0%,rgba(74,222,128,0.05) 45%,transparent 72%);border-radius:50%;display:flex;align-items:center;justify-content:center;animation:pulse 2s ease-in-out infinite}
.glow svg{width:34px;height:34px;color:#4ade80}
h1{font-size:24px;font-weight:700;color:#fafafa;margin-bottom:6px;letter-spacing:-0.03em}
.subtitle{color:#a1a1aa;font-size:14px;margin-bottom:24px}
.user-tag{display:inline-flex;align-items:center;gap:10px;background:rgba(88,101,242,0.1);border:1px solid rgba(88,101,242,0.16);padding:11px 18px;border-radius:16px;margin-bottom:18px;max-width:100%}
.user-tag svg{width:18px;height:18px;color:#8ea2ff;flex-shrink:0}
.user-tag span{font-size:14px;font-weight:600;color:#dbe3ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
.role-badge{display:inline-flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(74,222,128,0.12) 0%,rgba(34,197,94,0.08) 100%);color:#86efac;padding:9px 20px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.16em;border:1px solid rgba(74,222,128,0.14);margin-bottom:20px;text-transform:uppercase}
.info{color:#a1a1aa;font-size:13px;line-height:1.65;max-width:280px;margin:0 auto}
.sync-note{color:#71717a;font-size:11px;margin-top:18px;display:flex;align-items:center;justify-content:center;gap:7px;text-transform:uppercase;letter-spacing:.12em}
.sync-note .dot{width:6px;height:6px;background:#4ade80;border-radius:50%;animation:blink 1.5s ease-in-out infinite}
.back-link{display:inline-flex;align-items:center;justify-content:center;margin-top:26px;color:#d4d4d8;font-size:12px;font-weight:600;text-decoration:none;padding:11px 18px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);transition:all .2s ease}
.back-link:hover{color:#fff;border-color:rgba(255,255,255,0.16);background:rgba(255,255,255,0.04);transform:translateY(-1px)}
@media (max-width:520px){.card{padding:36px 22px 26px;border-radius:24px}.user-tag span{max-width:180px}}
@keyframes cardIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.2)}50%{box-shadow:0 0 0 16px rgba(74,222,128,0)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shrink{from{width:100%}to{width:0%}}
</style>
</head>
<body>
<div class="shell">
<div class="card">
<div class="shine"></div>
<div class="progress"></div>
<div class="glow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
<h1>Discord Connected</h1>
<p class="subtitle">You're all set</p>
<div class="user-tag">
<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
<span>${discordUser.username}</span>
</div>
<br>
<div class="role-badge">${roleLabel}</div>
<p class="info">Your role has been assigned based on your PropScholar account.</p>
<div class="sync-note"><span class="dot"></span> Syncing role in background</div>
<a class="back-link" href="${dashboardUrl}">\u2190 Back to Dashboard</a>
<script>setTimeout(function(){window.close()},5000)</script>
</div>
</div>
</body>
</html>`;

      return new Response(successHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error("OAuth callback error:", error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      const errorHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connection Failed</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{min-height:100%}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:radial-gradient(circle at top,rgba(248,113,113,0.08),transparent 26%),linear-gradient(180deg,#070505 0%,#09090b 100%);color:#e4e4e7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;-webkit-font-smoothing:antialiased;overflow:hidden}
.shell{position:relative;width:100%;display:flex;align-items:center;justify-content:center}
.shell::before,.shell::after{content:'';position:absolute;border-radius:999px;filter:blur(80px);pointer-events:none;opacity:.55}
.shell::before{width:220px;height:220px;background:rgba(248,113,113,0.08);top:-50px;right:10%}
.shell::after{width:200px;height:200px;background:rgba(239,68,68,0.08);bottom:-70px;left:8%}
.card{background:linear-gradient(180deg,rgba(255,255,255,0.045) 0%,rgba(255,255,255,0.02) 100%);border:1px solid rgba(248,113,113,0.12);border-radius:28px;padding:44px 34px 32px;text-align:center;max-width:430px;width:min(100%,430px);position:relative;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.45),inset 0 1px 0 rgba(255,255,255,0.04);backdrop-filter:blur(18px);animation:cardIn .6s cubic-bezier(.16,1,.3,1) both}
.card::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% -10%,rgba(248,113,113,0.08),transparent 34%);pointer-events:none}
.shine{position:absolute;top:0;left:50%;transform:translateX(-50%);height:1px;width:60%;background:linear-gradient(90deg,transparent,rgba(248,113,113,0.14),transparent)}
.icon-wrap{width:76px;height:76px;margin:0 auto 22px;background:radial-gradient(circle,rgba(248,113,113,0.18) 0%,rgba(248,113,113,0.05) 45%,transparent 72%);border-radius:50%;display:flex;align-items:center;justify-content:center}
.icon-wrap svg{width:34px;height:34px;color:#f87171}
h1{font-size:22px;font-weight:700;color:#fafafa;margin-bottom:8px;letter-spacing:-0.03em}
.msg{color:#a1a1aa;font-size:13px;line-height:1.7;word-break:break-word;max-width:320px;margin:0 auto}
.hint{color:#71717a;font-size:11px;margin-top:18px;text-transform:uppercase;letter-spacing:.12em}
.progress{position:absolute;bottom:0;left:0;height:2px;background:linear-gradient(90deg,#f87171,#ef4444);animation:shrink 8s linear forwards}
@media (max-width:520px){.card{padding:36px 22px 26px;border-radius:24px}}
@keyframes cardIn{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes shrink{from{width:100%}to{width:0%}}
</style>
</head>
<body>
<div class="shell">
<div class="card">
<div class="shine"></div>
<div class="progress"></div>
<div class="icon-wrap"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
<h1>Connection Failed</h1>
<p class="msg">${errMsg.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
<p class="hint">This window will close automatically</p>
<script>setTimeout(function(){window.close()},8000)</script>
</div>
</div>
</body>
</html>`;

      return new Response(errorHtml, {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  }

  return new Response("Not found", { status: 404 });
});
