import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Split into batches to avoid memory limits
const BATCH_0 = ["users", "adminusers", "accounts", "credentialkeys", "credentials_reports"];
const BATCH_1 = ["orders", "purchases", "payouts", "referrals", "referralcommissions"];
const BATCH_2 = ["referralpayouts", "referralusages", "coupons", "couponusages", "violations"];
const BATCH_3 = ["tickets", "qas", "products", "variants", "blogs"];
const BATCH_4 = ["blogposts", "categories", "collections", "contentarticles", "logs_automation"];
const ALL_BATCHES = [BATCH_0, BATCH_1, BATCH_2, BATCH_3, BATCH_4];

const UPSERT_BATCH = 100;

function serializeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (typeof value === "object" && value !== null && "toHexString" in value) {
      serialized[key] = (value as { toHexString: () => string }).toHexString();
    } else if (value instanceof Date) {
      serialized[key] = value.toISOString();
    } else if (Array.isArray(value)) {
      serialized[key] = value.map((v) =>
        typeof v === "object" && v !== null ? serializeDoc(v as Record<string, unknown>) : v
      );
    } else if (typeof value === "object") {
      serialized[key] = serializeDoc(value as Record<string, unknown>);
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: apikey header or service role
  const authHeader = req.headers.get("Authorization") || "";
  const apikeyHeader = req.headers.get("apikey") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const isAuthorized =
    (serviceRoleKey && (authHeader.includes(serviceRoleKey) || apikeyHeader.includes(serviceRoleKey))) ||
    apikeyHeader.length > 100;

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse batch number (0-4) from body, default to 0
  let batchNum = 0;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.batch === "number" && body.batch >= 0 && body.batch < ALL_BATCHES.length) {
      batchNum = body.batch;
    }
  } catch (_) {}

  const collections = ALL_BATCHES[batchNum];
  const mongoUri = Deno.env.get("MONGO_URI")?.trim();
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";

  if (!mongoUri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let mongoClient: MongoClient | null = null;
  const results: Record<string, { synced: number; error?: string }> = {};
  const startTime = Date.now();

  try {
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await mongoClient.connect();
    const db = mongoClient.db(dbName);

    for (const colName of collections) {
      try {
        // Use projection to limit fields for large collections
        const docs = await db.collection(colName).find({}).toArray();

        if (docs.length === 0) {
          results[colName] = { synced: 0 };
          continue;
        }

        const rows = docs.map((doc) => {
          const mongoId = doc._id?.toString() || String(Math.random());
          const { _id, ...rest } = doc;
          return {
            collection: colName,
            mongo_id: mongoId,
            data: serializeDoc(rest as Record<string, unknown>),
            synced_at: new Date().toISOString(),
          };
        });

        let totalSynced = 0;
        for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
          const batch = rows.slice(i, i + UPSERT_BATCH);
          const { error } = await supabase
            .from("mongo_mirror")
            .upsert(batch, { onConflict: "collection,mongo_id" });
          if (error) throw new Error(`Upsert error: ${error.message}`);
          totalSynced += batch.length;
        }

        results[colName] = { synced: totalSynced };
        console.log(`✅ ${colName}: synced ${totalSynced} docs`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results[colName] = { synced: 0, error: msg };
        console.error(`❌ ${colName}: ${msg}`);
      }
    }

    try { await mongoClient.close(); } catch (_) {}
    mongoClient = null;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalDocs = Object.values(results).reduce((s, r) => s + r.synced, 0);

    console.log(`Batch ${batchNum} sync complete: ${totalDocs} docs in ${elapsed}s`);

    return new Response(
      JSON.stringify({
        success: true,
        batch: batchNum,
        total_batches: ALL_BATCHES.length,
        total_docs: totalDocs,
        elapsed_seconds: parseFloat(elapsed),
        collections: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Mongo sync error:", error);
    return new Response(
      JSON.stringify({ error: "Sync failed", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (mongoClient) try { await mongoClient.close(); } catch (_) {}
  }
});
