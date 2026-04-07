import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { buildDiscordCertificateMessage } from "../_shared/discordCertificateMessage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function makeSlug(
  type: string,
  userName: string,
  account: string,
  mongoId: string
): string {
  const base = slugify(userName || "trader");
  const suffix = account || mongoId.slice(-6);
  return `${type}-${base}-${suffix}`;
}

function normalizePhase(phase: unknown): string | null {
  if (typeof phase !== "string" || !phase.trim()) return null;
  return phase.trim().toLowerCase().replace(/_/g, "-");
}

// Parse "Name (email@example.com)" format from assignedTo
function parseAssignedTo(val: unknown): { name: string | null; email: string | null } {
  if (typeof val !== "string" || !val.trim()) return { name: null, email: null };
  const match = val.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) return { name: match[1].trim(), email: match[2].trim().toLowerCase() };
  if (val.includes("@")) return { name: null, email: val.trim().toLowerCase() };
  return { name: val.trim(), email: null };
}

// --- Helper to get channel IDs from config ---
async function getChannelIds(supabase: any): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("widget_config")
      .select("config")
      .eq("id", "cert_announce_channel")
      .maybeSingle();
    if (!data?.config || typeof data.config !== "object") return [];
    const cfg = data.config as Record<string, string>;
    const ids: string[] = [];
    if (cfg.channel_id_1 || cfg.channel_id) ids.push(cfg.channel_id_1 || cfg.channel_id);
    if (cfg.channel_id_2) ids.push(cfg.channel_id_2);
    return ids.filter(Boolean);
  } catch (_) {
    return [];
  }
}

// --- Discord embed sender (sends to all configured channels) ---
async function announceToDiscord(
  botToken: string,
  channelIds: string[],
  cert: {
    user_name: string;
    account_number: string | null;
    certificate_url: string;
    certificate_type: string;
    phase: string | null;
    slug: string;
  }
) {
  const isAchievement = cert.certificate_type === "achievement";
  const color = isAchievement ? 0xfbbf24 : 0x22c55e;
  const title = isAchievement ? `🏆 New Funded Trader!` : `✅ Phase 1 Completed!`;
  const description = isAchievement
    ? `**${cert.user_name}** has earned a funded account after successfully completing the PropScholar evaluation!`
    : `**${cert.user_name}** has successfully completed Phase 1 of the PropScholar evaluation!`;

  const embed = {
    title,
    description,
    color,
    fields: [
      ...(cert.account_number
        ? [{ name: "Account", value: cert.account_number, inline: true }]
        : []),
      {
        name: "Type",
        value: isAchievement ? "Achievement Certificate" : "Completion Certificate",
        inline: true,
      },
    ],
    footer: { text: "PropScholar Hall of Fame" },
    timestamp: new Date().toISOString(),
  };

  for (const channelId of channelIds) {
    try {
      const message = await buildDiscordCertificateMessage(embed, cert.certificate_url);
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            ...(message.headers || {}),
          },
          body: message.body,
        }
      );
      if (!res.ok) {
        const text = await res.text();
        console.error(`Discord embed failed ch:${channelId} (${res.status}):`, text);
      } else {
        console.log(`Announced ${cert.user_name} to channel ${channelId}`);
      }
    } catch (e) {
      console.error(`Discord embed error ch:${channelId}:`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

// --- Cert extraction helpers ---
function extractPayoutCerts(payouts: any[]) {
  const certs: any[] = [];
  for (const doc of payouts) {
    const mongoId = doc._id.toString();
    const userName = doc.userName || doc.user_name || "Trader";
    const account =
      doc.accountNumber?.toString() || doc.account_number?.toString() || "";
    certs.push({
      user_name: userName,
      account_number: account || null,
      certificate_url: doc.certificateUrl,
      certificate_type: "achievement",
      phase: doc.phase || "funded",
      slug: makeSlug("achievement", userName, account, mongoId),
      mongo_source_id: mongoId,
      mongo_collection: "payouts",
      payout_amount: doc.payoutAmount || doc.payout_amount || null,
      status: doc.status || null,
    });
  }
  return certs;
}

async function extractCredKeyCerts(credKeys: any[], db: any) {
  const certs: any[] = [];

  for (const doc of credKeys) {
    const mongoId = doc._id.toString();
    const certUrl =
      typeof doc.completionCertificateUrl === "string"
        ? doc.completionCertificateUrl
        : "";
    let userName = "Trader";
    const account =
      doc.loginId?.toString() ||
      doc.accountNumber?.toString?.() ||
      doc.account_number?.toString?.() ||
      "";

    // Parse name directly from assignedTo string "Name (email)"
    if (doc.assignedTo) {
      const parsed = parseAssignedTo(doc.assignedTo);
      if (parsed.name) {
        userName = parsed.name;
      } else if (parsed.email) {
        userName = parsed.email.split("@")[0];
      }
    }

    if (certUrl) {
      certs.push({
        user_name: userName,
        account_number: account || null,
        certificate_url: certUrl,
        certificate_type: "completion",
        phase: normalizePhase(doc.phase) || "phase-1",
        slug: makeSlug("completion", userName, account, mongoId),
        mongo_source_id: mongoId,
        mongo_collection: "credentialkeys",
        payout_amount: null,
        status: doc.credentialStatus || doc.status || null,
      });
    }

    // Nested credentials
    if (Array.isArray(doc.credentials)) {
      for (const cred of doc.credentials) {
        if (!cred.completionCertificateUrl) continue;
        const credId = `${mongoId}-${cred.loginId || cred._id || "sub"}`;
        const credAccount =
          cred.loginId?.toString() ||
          account ||
          cred.assignedOrderId?.toString?.() ||
          "";
        let credUserName = "Trader";
        if (cred.assignedTo) {
          const parsed = parseAssignedTo(cred.assignedTo);
          if (parsed.name) {
            credUserName = parsed.name;
          } else if (parsed.email) {
            credUserName = parsed.email.split("@")[0];
          }
        }
        certs.push({
          user_name: credUserName,
          account_number: credAccount || null,
          certificate_url: cred.completionCertificateUrl,
          certificate_type: "completion",
          phase: normalizePhase(cred.phase) || "phase-1",
          slug: makeSlug("completion", credUserName, credAccount, credId),
          mongo_source_id: credId,
          mongo_collection: "credentialkeys",
          payout_amount: null,
          status: cred.credentialStatus || cred.status || null,
        });
      }
    }
  }
  return certs;
}

// --- Main handler ---
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Test mode: send a sample embed without syncing
  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  // Special actions
  if (body?.action === "manual_announce") {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const channelIds = await getChannelIds(sb);
    if (!botToken || channelIds.length === 0) {
      return new Response(JSON.stringify({ error: "Bot token or channels not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Get the latest 3 certificates, optionally filtered by type
    let query = sb
      .from("hall_of_fame_certificates")
      .select("*")
      .order("created_at", { ascending: false });
    if (body.certificate_type) query = query.eq("certificate_type", body.certificate_type);
    if (body.phase) query = query.eq("phase", body.phase);
    const { data: latestCerts } = await query.limit(body.count || 3);
    if (!latestCerts || latestCerts.length === 0) {
      return new Response(JSON.stringify({ error: "No certificates found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let announced = 0;
    for (const cert of latestCerts) {
      await announceToDiscord(botToken, channelIds, cert);
      announced++;
    }
    return new Response(JSON.stringify({ success: true, announced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Debug: inspect assignedTo and user lookup
  if (body?.action === "debug") {
    const uri = Deno.env.get("MONGO_URI");
    if (!uri) return new Response(JSON.stringify({ error: "no MONGO_URI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
    let mc: MongoClient | null = null;
    try {
      mc = new MongoClient(uri);
      await mc.connect();
      const db = mc.db(dbName);

      // Get a sample credentialkey doc with nested certs
      const sampleNested = await db.collection("credentialkeys").findOne({ "credentials.completionCertificateUrl": { $exists: true } });
      const parentFields = sampleNested ? Object.keys(sampleNested) : [];
      const parentKey = sampleNested?.key;
      const parentAssignedTo = sampleNested?.assignedTo;
      const parentUserId = sampleNested?.userId || sampleNested?.user || sampleNested?.owner;

      // Check nested cred assignedTo
      const nestedCreds = sampleNested?.credentials?.filter((c: any) => c.completionCertificateUrl) || [];
      const nestedSample = nestedCreds[0] || {};
      const nestedFields = Object.keys(nestedSample);
      const nestedAssignedTo = nestedSample.assignedTo;

      // Try looking up user by the key field (might be email)
      let userByKey = null;
      if (parentKey) {
        userByKey = await db.collection("users").findOne({
          $or: [
            { email: parentKey },
            { email: parentKey.toString().toLowerCase() },
          ],
        });
      }

      // Try looking up by parent assignedTo
      let userByAssignedTo = null;
      if (parentAssignedTo) {
        const { ObjectId } = await import("npm:mongodb@6.12.0");
        let oid: any = parentAssignedTo;
        try { oid = new ObjectId(parentAssignedTo.toString()); } catch (_) {}
        userByAssignedTo = await db.collection("users").findOne({
          $or: [
            { _id: oid },
            { _id: parentAssignedTo },
            { email: parentAssignedTo.toString().toLowerCase() },
          ],
        });
      }

      // Sample users collection fields
      const sampleUser = await db.collection("users").findOne({});
      const userFields = sampleUser ? Object.keys(sampleUser) : [];

      return new Response(JSON.stringify({
        parentFields,
        parentKey: parentKey?.toString?.() || null,
        parentAssignedTo: parentAssignedTo?.toString?.() || null,
        parentUserId: parentUserId?.toString?.() || null,
        nestedFields,
        nestedAssignedTo: nestedAssignedTo?.toString?.() || null,
        userByKeyFound: !!userByKey,
        userByKeyName: userByKey ? (userByKey.displayName || userByKey.name || userByKey.firstName || userByKey.email) : null,
        userByAssignedToFound: !!userByAssignedTo,
        userByAssignedToName: userByAssignedTo ? (userByAssignedTo.displayName || userByAssignedTo.name || userByAssignedTo.firstName || userByAssignedTo.email) : null,
        userFields,
      }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      if (mc) try { await mc.close(); } catch (_) {}
    }
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const uri = Deno.env.get("MONGO_URI");
  if (!uri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey!);
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";

  let client: MongoClient | null = null;

  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    // 1. Fetch from MongoDB
    const payouts = await db
      .collection("payouts")
      .find({ certificateUrl: { $exists: true, $ne: null } })
      .toArray();

    const credKeys = await db
      .collection("credentialkeys")
      .find({})
      .toArray();

    const certificates = [
      ...extractPayoutCerts(payouts),
      ...(await extractCredKeyCerts(credKeys, db)),
    ];

    console.log(`Found ${certificates.length} total certificates to sync`);

    // 2. Load Discord config
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
    const channelIds = await getChannelIds(supabase);

    // 3. Upsert into Supabase
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const newCerts: typeof certificates = [];

    for (const cert of certificates) {
      const { data: existing } = await supabase
        .from("hall_of_fame_certificates")
        .select("id")
        .eq("mongo_source_id", cert.mongo_source_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("hall_of_fame_certificates")
          .update({
            user_name: cert.user_name,
            account_number: cert.account_number,
            certificate_url: cert.certificate_url,
            phase: cert.phase,
            payout_amount: cert.payout_amount,
            status: cert.status,
            synced_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) {
          console.error(`Update error for ${cert.mongo_source_id}:`, error);
          errors++;
        } else {
          updated++;
        }
      } else {
        const { error } = await supabase
          .from("hall_of_fame_certificates")
          .insert(cert);
        if (error) {
          if (error.code === "23505" && error.message?.includes("slug")) {
            cert.slug = `${cert.slug}-${Date.now().toString(36)}`;
            const { error: retryErr } = await supabase
              .from("hall_of_fame_certificates")
              .insert(cert);
            if (retryErr) {
              console.error(`Insert retry error:`, retryErr);
              errors++;
            } else {
              inserted++;
              newCerts.push(cert);
            }
          } else {
            console.error(`Insert error for ${cert.mongo_source_id}:`, error);
            errors++;
          }
        } else {
          inserted++;
          newCerts.push(cert);
        }
      }
    }

    // 4. Send Discord announcements for NEW certs only
    if (botToken && channelIds.length > 0 && newCerts.length > 0) {
      console.log(`Sending ${newCerts.length} certs to ${channelIds.length} channels`);
      for (const cert of newCerts) {
        await announceToDiscord(botToken, channelIds, cert);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: certificates.length,
        inserted,
        updated,
        errors,
        announced: newCerts.length,
        synced_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-certificates error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to sync certificates" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (_) {}
    }
  }
});
