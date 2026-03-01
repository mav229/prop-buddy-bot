import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

// Role priority: Scholar > Examinee > Student
function determineRole(collections: Record<string, unknown[]>): "student" | "examinee" | "scholar" {
  const payouts = collections["payouts"] || [];
  const purchases = collections["purchases"] || [];
  const orders = collections["orders"] || [];

  if (payouts.length > 0) return "scholar";
  if (purchases.length > 0 || orders.length > 0) return "examinee";
  return "student";
}

function getRoleId(role: "student" | "examinee" | "scholar"): string {
  const map: Record<string, string> = {
    student: Deno.env.get("STUDENT_ROLE_ID") || "",
    examinee: Deno.env.get("EXAMINEE_ROLE_ID") || "",
    scholar: Deno.env.get("SCHOLAR_ROLE_ID") || "",
  };
  return map[role];
}

const ALL_ROLE_KEYS = ["student", "examinee", "scholar"] as const;

async function assignDiscordRole(
  discordUserId: string,
  newRole: "student" | "examinee" | "scholar"
): Promise<void> {
  const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
  const guildId = Deno.env.get("DISCORD_GUILD_ID");
  if (!botToken || !guildId) throw new Error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");

  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  // Remove all three roles first, then add the correct one
  for (const roleKey of ALL_ROLE_KEYS) {
    const roleId = getRoleId(roleKey);
    if (!roleId) continue;
    if (roleKey === newRole) continue;
    // Remove old role (ignore 404s)
    const res = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
      { method: "DELETE", headers }
    );
    if (!res.ok && res.status !== 404) {
      console.warn(`Failed to remove role ${roleKey}: ${res.status}`);
    }
  }

  // Add new role
  const newRoleId = getRoleId(newRole);
  if (!newRoleId) throw new Error(`No role ID configured for ${newRole}`);

  const addRes = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${discordUserId}/roles/${newRoleId}`,
    { method: "PUT", headers }
  );
  if (!addRes.ok) {
    const t = await addRes.text().catch(() => "");
    throw new Error(`Failed to assign role ${newRole}: ${addRes.status} ${t}`);
  }
}

async function fetchUserDataFromMongo(email: string): Promise<Record<string, unknown[]>> {
  const uri = Deno.env.get("MONGO_URI");
  if (!uri) throw new Error("MONGO_URI not configured");

  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.collection("users").findOne({ 
      email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (!user) return {};

    const userId = user._id;
    const userIdStr = userId.toString();
    const collections: Record<string, unknown[]> = {};

    // Only fetch what we need for role determination
    for (const colName of ["purchases", "orders", "payouts"]) {
      try {
        const docs = await db.collection(colName).find({
          $or: [
            { userId: userId },
            { userId: userIdStr },
            { user: userId },
            { user: userIdStr },
            { email: normalizedEmail },
            { customerEmail: normalizedEmail },
            { buyerEmail: normalizedEmail },
          ]
        }).limit(5).toArray();
        if (docs.length > 0) collections[colName] = docs;
      } catch (err) {
        console.error(`Error fetching ${colName}:`, err);
      }
    }

    return collections;
  } finally {
    try { await client.close(); } catch (_) { /* ignore */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  // --- ACTION: Generate OAuth URL ---
  if (req.method === "POST") {
    try {
      const { action, email, code } = await req.json();

      if (action === "get_oauth_url") {
        const clientId = Deno.env.get("DISCORD_CLIENT_ID");
        if (!clientId) throw new Error("DISCORD_CLIENT_ID not configured");

        // Use the edge function URL as redirect
        const redirectUri = `${url.origin}/functions/v1/discord-connect?callback=true`;
        const state = btoa(JSON.stringify({ email }));
        const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=identify+guilds.join&state=${encodeURIComponent(state)}`;

        return new Response(JSON.stringify({ url: oauthUrl }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- ACTION: Manual sync ---
      if (action === "sync") {
        if (!email) throw new Error("Email required for sync");

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // Find existing connection
        const { data: conn } = await supabase
          .from("discord_connections")
          .select("*")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle();

        if (!conn) {
          return new Response(JSON.stringify({ error: "No Discord connection found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Re-evaluate role from MongoDB
        const collections = await fetchUserDataFromMongo(email);
        const newRole = determineRole(collections);

        // Assign Discord role
        await assignDiscordRole(conn.discord_user_id, newRole);

        // Update DB
        await supabase
          .from("discord_connections")
          .update({
            assigned_role: newRole,
            last_role_update: new Date().toISOString(),
            needs_sync: false,
            last_synced_at: new Date().toISOString(),
          })
          .eq("email", email.toLowerCase().trim());

        return new Response(JSON.stringify({ 
          success: true, 
          role: newRole,
          previous_role: conn.assigned_role,
          changed: conn.assigned_role !== newRole,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // --- ACTION: Check status ---
      if (action === "status") {
        if (!email) throw new Error("Email required");

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: conn } = await supabase
          .from("discord_connections")
          .select("*")
          .eq("email", email.toLowerCase().trim())
          .maybeSingle();

        return new Response(JSON.stringify({ connected: !!conn, connection: conn }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Discord connect error:", error);
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // --- GET: OAuth Callback ---
  if (req.method === "GET" && url.searchParams.get("callback") === "true") {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");

    if (!code || !stateParam) {
      return new Response("<h1>Error: Missing code or state</h1>", {
        status: 400,
        headers: { "Content-Type": "text/html" },
      });
    }

    try {
      const state = JSON.parse(atob(stateParam));
      const email = state.email?.toLowerCase().trim();
      if (!email) throw new Error("No email in state");

      const clientId = Deno.env.get("DISCORD_CLIENT_ID")!;
      const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET")!;
      const redirectUri = `${url.origin}/functions/v1/discord-connect?callback=true`;

      // Exchange code for token
      const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

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

      // Add user to guild if not already a member
      const guildId = Deno.env.get("DISCORD_GUILD_ID")!;
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN")!;
      await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUser.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      });

      // Fetch MongoDB data and determine role
      const collections = await fetchUserDataFromMongo(email);
      const role = determineRole(collections);

      console.log(`Role determination for ${email}: ${role} (payouts: ${(collections.payouts || []).length}, purchases: ${(collections.purchases || []).length}, orders: ${(collections.orders || []).length})`);

      // Assign Discord role
      await assignDiscordRole(discordUser.id, role);

      // Store in database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);

      await supabase.from("discord_connections").upsert({
        email,
        discord_user_id: discordUser.id,
        discord_username: discordUser.username,
        discord_avatar: discordUser.avatar,
        assigned_role: role,
        last_role_update: new Date().toISOString(),
        needs_sync: false,
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "email" });

      // Redirect back to dashboard with success
      const dashboardUrl = Deno.env.get("DASHBOARD_REDIRECT_URL") || "https://prop-buddy-bot.lovable.app/fullpage";
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

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
        <body><div class="card"><h1>❌ Connection Failed</h1><p>${error instanceof Error ? error.message : "Unknown error"}</p>
        <script>setTimeout(()=>{window.close()},8000)</script>
        </div></body></html>`,
        { status: 500, headers: { "Content-Type": "text/html" } }
      );
    }
  }

  return new Response("Not found", { status: 404 });
});
