import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API = "https://discord.com/api/v10";

type PlatformRole = "student" | "examinee" | "scholar";
const ALL_ROLES: PlatformRole[] = ["student", "examinee", "scholar"];

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getRoleId(role: PlatformRole): string {
  const map: Record<PlatformRole, string> = {
    student: Deno.env.get("STUDENT_ROLE_ID") || "",
    examinee: Deno.env.get("EXAMINEE_ROLE_ID") || "",
    scholar: Deno.env.get("SCHOLAR_ROLE_ID") || "",
  };
  return map[role];
}

function getDiscordBotToken(): string {
  const token = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!token) throw new Error("Missing DISCORD_BOT_TOKEN");
  return token.replace(/^Bot\s+/i, "").trim();
}

function getDiscordGuildId(): string {
  const guildId = Deno.env.get("DISCORD_GUILD_ID");
  if (!guildId) throw new Error("Missing DISCORD_GUILD_ID");
  return guildId;
}

const TEST_ROLE_OVERRIDES: Record<string, PlatformRole> = {
  "s.saurav2006@gmail.com": "scholar",
};

function determineRole(
  collections: Record<string, unknown[]>,
  email?: string
): PlatformRole {
  if (email && TEST_ROLE_OVERRIDES[email.toLowerCase().trim()]) {
    return TEST_ROLE_OVERRIDES[email.toLowerCase().trim()];
  }
  if ((collections["payouts"] || []).length > 0) return "scholar";
  if (
    (collections["purchases"] || []).length > 0 ||
    (collections["orders"] || []).length > 0
  )
    return "examinee";
  return "student";
}

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

async function assignDiscordRole(
  discordUserId: string,
  newRole: PlatformRole,
  previousRole?: string | null
): Promise<void> {
  if (previousRole === newRole) {
    return;
  }

  const botToken = getDiscordBotToken();
  const guildId = getDiscordGuildId();
  const headers = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

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
          .limit(1)
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
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  
  if (!authHeader.includes(anonKey) && !authHeader.includes(serviceKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabase();
  const results: { email: string; previous: string; new_role: string; changed: boolean; error?: string }[] = [];

  try {
    const { data: connections, error: fetchErr } = await supabase
      .from("discord_connections")
      .select("*");

    if (fetchErr) throw fetchErr;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No connections to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Cron: syncing ${connections.length} connections`);

    for (const conn of connections) {
      try {
        const collections = await fetchUserDataFromMongo(conn.email);
        const newRole = determineRole(collections, conn.email);
        const changed = conn.assigned_role !== newRole;

        if (changed) {
          await assignDiscordRole(conn.discord_user_id, newRole, conn.assigned_role);
          await supabase
            .from("discord_connections")
            .update({
              assigned_role: newRole,
              last_role_update: new Date().toISOString(),
              needs_sync: false,
              last_synced_at: new Date().toISOString(),
            })
            .eq("email", conn.email);

          await supabase.from("discord_connection_logs").insert({
            email: conn.email,
            discord_username: conn.discord_username,
            discord_user_id: conn.discord_user_id,
            action: "cron_sync",
            status: "success",
            assigned_role: newRole,
          });

          console.log(`Updated: ${conn.email} ${conn.assigned_role} → ${newRole}`);
        } else {
          await supabase
            .from("discord_connections")
            .update({
              needs_sync: false,
              last_synced_at: new Date().toISOString(),
            })
            .eq("email", conn.email);
        }

        results.push({
          email: conn.email,
          previous: conn.assigned_role,
          new_role: newRole,
          changed,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to sync ${conn.email}:`, errorMsg);
        results.push({
          email: conn.email,
          previous: conn.assigned_role,
          new_role: conn.assigned_role,
          changed: false,
          error: errorMsg,
        });
      }
    }

    const changedCount = results.filter((r) => r.changed).length;
    const errorCount = results.filter((r) => r.error).length;

    return new Response(
      JSON.stringify({
        message: `Synced ${connections.length} connections. ${changedCount} updated, ${errorCount} errors.`,
        total: connections.length,
        changed: changedCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Cron sync failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Cron sync failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
