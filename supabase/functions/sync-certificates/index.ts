import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

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
    image: { url: cert.certificate_url },
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
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ embeds: [embed] }),
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
    const certUrl = doc.completionCertificateUrl;
    let userName = "Trader";
    const account = doc.loginId?.toString() || "";

    if (doc.assignedTo) {
      try {
        const user = await db.collection("users").findOne({ _id: doc.assignedTo });
        if (user) {
          userName =
            user.displayName || user.name || user.firstName ||
            user.username || user.email?.split("@")[0] || "Trader";
        }
      } catch (_) {}
    }

    certs.push({
      user_name: userName,
      account_number: account || null,
      certificate_url: certUrl,
      certificate_type: "completion",
      phase: doc.phase || "phase-1",
      slug: makeSlug("completion", userName, account, mongoId),
      mongo_source_id: mongoId,
      mongo_collection: "credentialkeys",
      payout_amount: null,
      status: doc.status || null,
    });

    // Nested credentials
    if (Array.isArray(doc.credentials)) {
      for (const cred of doc.credentials) {
        if (!cred.completionCertificateUrl) continue;
        const credId = `${mongoId}-${cred.loginId || cred._id || "sub"}`;
        let credUserName = "Trader";
        if (cred.assignedTo) {
          try {
            const user = await db.collection("users").findOne({
              $or: [
                { _id: cred.assignedTo },
                { email: cred.assignedTo?.toString?.()?.toLowerCase?.() },
              ],
            });
            if (user) {
              credUserName =
                user.displayName || user.name || user.firstName ||
                user.email?.split("@")[0] || "Trader";
            }
          } catch (_) {}
        }
        certs.push({
          user_name: credUserName,
          account_number: cred.loginId?.toString() || null,
          certificate_url: cred.completionCertificateUrl,
          certificate_type: "completion",
          phase: cred.phase || "phase-1",
          slug: makeSlug("completion", credUserName, cred.loginId?.toString() || "", credId),
          mongo_source_id: credId,
          mongo_collection: "credentialkeys",
          payout_amount: null,
          status: cred.status || null,
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
    // Get the latest 3 certificates
    const { data: latestCerts } = await sb
      .from("hall_of_fame_certificates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3);
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
      .find({ completionCertificateUrl: { $exists: true, $ne: null } })
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
    if (botToken && announceChannelId && newCerts.length > 0) {
      console.log(`Sending ${newCerts.length} Discord announcements to channel ${announceChannelId}`);
      for (const cert of newCerts) {
        await sendDiscordEmbed(botToken, announceChannelId, cert);
        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 1000));
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
