import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALL_COLLECTIONS = [
  "users", "adminusers", "accounts", "credentialkeys", "credentials_reports",
  "orders", "purchases", "payouts", "referrals", "referralcommissions",
  "referralpayouts", "referralusages", "coupons", "couponusages", "violations",
  "tickets", "qas", "products", "variants", "blogs",
  "blogposts", "categories", "collections", "contentarticles", "logs_automation",
];

const UPSERT_BATCH = 50;

function serializeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) {
    if (v === null || v === undefined) s[k] = v;
    else if (typeof v === "object" && v !== null && "toHexString" in v) s[k] = (v as { toHexString: () => string }).toHexString();
    else if (v instanceof Date) s[k] = v.toISOString();
    else if (Array.isArray(v)) s[k] = v.map((x) => typeof x === "object" && x !== null ? serializeDoc(x as Record<string, unknown>) : x);
    else if (typeof v === "object") s[k] = serializeDoc(v as Record<string, unknown>);
    else s[k] = v;
  }
  return s;
}

async function syncCollection(
  db: ReturnType<MongoClient["db"]>,
  supabase: ReturnType<typeof createClient>,
  colName: string,
): Promise<{ synced: number; error?: string }> {
  try {
    const largeCollections = ["users", "orders", "purchases", "logs_automation"];
    const options = largeCollections.includes(colName)
      ? { projection: { tradeHistory: 0, __v: 0, responseBody: 0, requestBody: 0 } }
      : {};

    // For logs_automation, only sync last 30 days to avoid OOM
    const filter = colName === "logs_automation"
      ? { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      : {};

    const cursor = db.collection(colName).find(filter, options);
    let totalSynced = 0;
    let batch: { collection: string; mongo_id: string; data: Record<string, unknown>; synced_at: string }[] = [];

    for await (const doc of cursor) {
      const mongoId = doc._id?.toString() || String(Math.random());
      const { _id, ...rest } = doc;
      batch.push({
        collection: colName,
        mongo_id: mongoId,
        data: serializeDoc(rest as Record<string, unknown>),
        synced_at: new Date().toISOString(),
      });

      if (batch.length >= UPSERT_BATCH) {
        const { error } = await supabase
          .from("mongo_mirror")
          .upsert(batch, { onConflict: "collection,mongo_id" });
        if (error) throw new Error(`Upsert: ${error.message}`);
        totalSynced += batch.length;
        batch = [];
      }
    }

    // Flush remaining
    if (batch.length > 0) {
      const { error } = await supabase
        .from("mongo_mirror")
        .upsert(batch, { onConflict: "collection,mongo_id" });
      if (error) throw new Error(`Upsert: ${error.message}`);
      totalSynced += batch.length;
    }

    console.log(`✅ ${colName}: synced ${totalSynced} docs`);
    return { synced: totalSynced };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ ${colName}: ${msg}`);
    return { synced: 0, error: msg };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  // Accept a single collection name or an index
  let targetCollections: string[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (body.collection && ALL_COLLECTIONS.includes(body.collection)) {
      targetCollections = [body.collection];
    } else if (typeof body.index === "number" && body.index >= 0 && body.index < ALL_COLLECTIONS.length) {
      targetCollections = [ALL_COLLECTIONS[body.index]];
    } else {
      // Default: sync all but one at a time via sequential calls
      targetCollections = ALL_COLLECTIONS;
    }
  } catch (_) {
    targetCollections = ALL_COLLECTIONS;
  }

  const mongoUri = Deno.env.get("MONGO_URI")?.trim();
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";

  if (!mongoUri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
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

    for (const colName of targetCollections) {
      results[colName] = await syncCollection(db, supabase, colName);
    }

    try { await mongoClient.close(); } catch (_) {}
    mongoClient = null;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalDocs = Object.values(results).reduce((s, r) => s + r.synced, 0);

    return new Response(
      JSON.stringify({
        success: true,
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
