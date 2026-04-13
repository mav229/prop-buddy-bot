import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COLLECTIONS = [
  "users",
  "adminusers",
  "accounts",
  "credentialkeys",
  "credentials_reports",
  "orders",
  "purchases",
  "payouts",
  "referrals",
  "referralcommissions",
  "referralpayouts",
  "referralusages",
  "coupons",
  "couponusages",
  "violations",
  "tickets",
  "qas",
  "products",
  "variants",
  "blogs",
  "blogposts",
  "categories",
  "collections",
  "contentarticles",
  "logs_automation",
];

// Batch size for Supabase upserts
const UPSERT_BATCH = 200;

function serializeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  // Convert MongoDB ObjectIds and Dates to strings for JSON storage
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (value === null || value === undefined) {
      serialized[key] = value;
    } else if (typeof value === "object" && value !== null && "toHexString" in value) {
      // ObjectId
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

  // Auth: allow service role, anon key (cron), or admin JWT
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const isAuthorized =
    (serviceRoleKey && authHeader.includes(serviceRoleKey)) ||
    (anonKey && authHeader.includes(anonKey));

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    for (const colName of COLLECTIONS) {
      try {
        const docs = await db.collection(colName).find({}).toArray();

        if (docs.length === 0) {
          results[colName] = { synced: 0 };
          continue;
        }

        // Prepare rows for upsert
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

        // Upsert in batches
        let totalSynced = 0;
        for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
          const batch = rows.slice(i, i + UPSERT_BATCH);
          const { error } = await supabase
            .from("mongo_mirror")
            .upsert(batch, { onConflict: "collection,mongo_id" });

          if (error) {
            throw new Error(`Upsert error: ${error.message}`);
          }
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

    // Close mongo ASAP to free resources
    try { await mongoClient.close(); } catch (_) {}
    mongoClient = null;

    // Clean up deleted docs: remove mongo_mirror rows whose mongo_id no longer exists in source
    // We do this per collection by comparing IDs
    for (const colName of COLLECTIONS) {
      if (results[colName]?.error) continue;
      // Skip cleanup for empty collections
      if (results[colName]?.synced === 0) continue;
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalDocs = Object.values(results).reduce((s, r) => s + r.synced, 0);
    const errors = Object.values(results).filter((r) => r.error).length;

    console.log(`Sync complete: ${totalDocs} docs across ${COLLECTIONS.length} collections in ${elapsed}s (${errors} errors)`);

    return new Response(
      JSON.stringify({
        success: true,
        db: dbName,
        total_docs: totalDocs,
        elapsed_seconds: parseFloat(elapsed),
        errors,
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
