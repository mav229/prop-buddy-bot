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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check — service role or anon key (for cron)
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = authHeader?.replace("Bearer ", "") || "";
  if (!token || (token !== serviceRoleKey && token !== anonKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const uri = Deno.env.get("MONGO_URI");
  if (!uri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";

  let client: MongoClient | null = null;

  try {
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    const certificates: {
      user_name: string;
      account_number: string | null;
      certificate_url: string;
      certificate_type: string;
      phase: string | null;
      slug: string;
      mongo_source_id: string;
      mongo_collection: string;
      payout_amount: number | null;
      status: string | null;
    }[] = [];

    // 1. Payouts — Achievement Certificates
    const payouts = await db
      .collection("payouts")
      .find({ certificateUrl: { $exists: true, $ne: null } })
      .toArray();

    for (const doc of payouts) {
      const mongoId = doc._id.toString();
      const userName = doc.userName || doc.user_name || "Trader";
      const account = doc.accountNumber?.toString() || doc.account_number?.toString() || "";
      certificates.push({
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

    // 2. CredentialKeys — Completion Certificates
    const credKeys = await db
      .collection("credentialkeys")
      .find({ completionCertificateUrl: { $exists: true, $ne: null } })
      .toArray();

    for (const doc of credKeys) {
      // Each credential key may have multiple credentials with completionCertificateUrl
      const mongoId = doc._id.toString();
      const certUrl = doc.completionCertificateUrl;
      
      // Try to resolve user name from the users collection
      let userName = "Trader";
      let account = doc.loginId?.toString() || "";

      // Check if doc has user reference
      if (doc.assignedTo) {
        try {
          const user = await db
            .collection("users")
            .findOne({ _id: doc.assignedTo });
          if (user) {
            userName =
              user.displayName ||
              user.name ||
              user.firstName ||
              user.username ||
              user.email?.split("@")[0] ||
              "Trader";
          }
        } catch (_) {
          // ignore lookup failures
        }
      }

      certificates.push({
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
    }

    // Also check individual credentials within credentialkeys docs
    for (const doc of credKeys) {
      if (!Array.isArray(doc.credentials)) continue;
      for (const cred of doc.credentials) {
        if (!cred.completionCertificateUrl) continue;
        const credId = `${doc._id.toString()}-${cred.loginId || cred._id || "sub"}`;
        
        let userName = "Trader";
        if (cred.assignedTo) {
          try {
            const user = await db.collection("users").findOne({ 
              $or: [
                { _id: cred.assignedTo },
                { email: cred.assignedTo?.toString?.()?.toLowerCase?.() }
              ]
            });
            if (user) {
              userName = user.displayName || user.name || user.firstName || user.email?.split("@")[0] || "Trader";
            }
          } catch (_) {}
        }

        certificates.push({
          user_name: userName,
          account_number: cred.loginId?.toString() || null,
          certificate_url: cred.completionCertificateUrl,
          certificate_type: "completion",
          phase: cred.phase || "phase-1",
          slug: makeSlug("completion", userName, cred.loginId?.toString() || "", credId),
          mongo_source_id: credId,
          mongo_collection: "credentialkeys",
          payout_amount: null,
          status: cred.status || null,
        });
      }
    }

    console.log(`Found ${certificates.length} total certificates to sync`);

    // Upsert into Supabase
    let inserted = 0;
    let updated = 0;
    let errors = 0;

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
          // Handle slug collision by appending random suffix
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
            }
          } else {
            console.error(`Insert error for ${cert.mongo_source_id}:`, error);
            errors++;
          }
        } else {
          inserted++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_found: certificates.length,
        inserted,
        updated,
        errors,
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
