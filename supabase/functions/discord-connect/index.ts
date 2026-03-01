import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

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

  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const guildId = Deno.env.get("DISCORD_GUILD_ID");
  if (!botToken || !guildId)
    throw new Error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");

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
      return new Response("<h1>Error: Missing code or state</h1>", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    try {
      // Fix 1: Verify HMAC-signed state
      const statePayload = await verifyState(stateParam);
      if (!statePayload || !statePayload.email) {
        return new Response(
          "<h1>Error: Invalid or expired state token</h1>",
          { status: 403, headers: { "Content-Type": "text/html" } }
        );
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
      const guildId = Deno.env.get("DISCORD_GUILD_ID")!;
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
      await discordFetch(
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

      return new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Connected!</title>
        <style>body{font-family:system-ui;background:#0a0a0a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#141414;border:1px solid #222;border-radius:16px;padding:40px;text-align:center;max-width:400px}
        h1{color:#fff;font-size:20px;margin-bottom:8px}p{color:#888;font-size:14px}
        .role{display:inline-block;background:#1a3a1a;color:#4ade80;padding:4px 12px;border-radius:8px;font-size:13px;font-weight:600;margin:12px 0}
        a{color:#888;font-size:12px;text-decoration:underline}</style></head>
        <body><div class="card">
        <h1>✅ Discord Connected!</h1>
        <p>Welcome, <strong>${discordUser.username}</strong></p>
        <div class="role">${roleLabel}</div>
        <p>Your role has been assigned based on your PropScholar account.</p>
        <p style="color:#555;font-size:11px;margin-top:8px">Role syncing in background…</p>
        <br><a href="${dashboardUrl}">← Back to Dashboard</a>
        <script>setTimeout(()=>{window.close()},5000)</script>
        </div></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    } catch (error) {
      console.error("OAuth callback error:", error);
      return new Response(
        `<!DOCTYPE html><html><head><title>Error</title>
        <style>body{font-family:system-ui;background:#0a0a0a;color:#e0e0e0;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
        .card{background:#1a1010;border:1px solid #3a1010;border-radius:16px;padding:40px;text-align:center;max-width:400px}
        h1{color:#f87171;font-size:18px}p{color:#888;font-size:13px}</style></head>
        <body><div class="card"><h1>❌ Connection Failed</h1><p>${
          error instanceof Error ? error.message : "Unknown error"
        }</p>
        <script>setTimeout(()=>{window.close()},8000)</script>
        </div></body></html>`,
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }
  }

  return new Response("Not found", { status: 404 });
});
