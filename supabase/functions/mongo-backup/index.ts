import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function hasValidMongoScheme(uri: string): boolean {
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

function formatMongoError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const isServiceRole = serviceRoleKey && authHeader.includes(serviceRoleKey);
  const isAnonCron = anonKey && authHeader.includes(anonKey);

  // Allow service role or anon key (cron), OR validate user JWT with admin role
  if (!isServiceRole && !isAnonCron) {
    // Try JWT-based auth for admin users
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const sourceUri = Deno.env.get("MONGO_URI")?.trim();
  const destUri = Deno.env.get("MONGO_BACKUP_URI")?.trim();
  const sourceDbName = Deno.env.get("MONGO_DB_NAME") || "test";

  if (!sourceUri) {
    return new Response(
      JSON.stringify({ error: "MONGO_URI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!destUri) {
    return new Response(
      JSON.stringify({ error: "MONGO_BACKUP_URI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!hasValidMongoScheme(sourceUri)) {
    return new Response(
      JSON.stringify({ error: "Invalid MONGO_URI scheme", details: "Expected mongodb:// or mongodb+srv://" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!hasValidMongoScheme(destUri)) {
    return new Response(
      JSON.stringify({ error: "Invalid MONGO_BACKUP_URI scheme", details: "Expected mongodb:// or mongodb+srv://" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Parse destination DB name from URI or use same name with _backup suffix
  let destDbName = sourceDbName + "_backup";
  try {
    const body = await req.json().catch(() => ({}));
    if (body.dest_db_name) destDbName = body.dest_db_name;
  } catch (_) { /* use default */ }

  let sourceClient: MongoClient | null = null;
  let destClient: MongoClient | null = null;

  const results: Record<string, { copied: number; error?: string }> = {};
  const startTime = Date.now();

  try {
    sourceClient = new MongoClient(sourceUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    await sourceClient.connect();

    try {
      destClient = new MongoClient(destUri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });
      await destClient.connect();
    } catch (destErr) {
      const destMessage = formatMongoError(destErr);
      const likelyTlsIssue =
        destMessage.includes("received fatal alert") ||
        destMessage.toLowerCase().includes("tls") ||
        destMessage.toLowerCase().includes("ssl");

      if (!likelyTlsIssue) {
        throw new Error(`Destination Mongo connection failed: ${destMessage}`);
      }

      console.warn("Destination Mongo TLS handshake failed; retrying with relaxed TLS settings.");
      const retryUri = `${destUri}${destUri.includes("?") ? "&" : "?"}tls=true&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true`;
      destClient = new MongoClient(retryUri, {
        serverSelectionTimeoutMS: 20000,
        connectTimeoutMS: 20000,
      });

      try {
        await destClient.connect();
      } catch (retryErr) {
        throw new Error(
          `Destination Mongo TLS failed after retry. Verify backup cluster TLS/network settings or use a standard mongodb:// URI. Details: ${formatMongoError(retryErr)}`
        );
      }
    }

    const sourceDb = sourceClient.db(sourceDbName);
    const destDb = destClient.db(destDbName);

    // Process collections sequentially to avoid overwhelming connections
    for (const colName of COLLECTIONS) {
      try {
        const sourceCol = sourceDb.collection(colName);
        const destCol = destDb.collection(colName);

        // Fetch all documents from source
        const docs = await sourceCol.find({}).toArray();

        if (docs.length === 0) {
          results[colName] = { copied: 0 };
          continue;
        }

        // Drop destination collection and re-insert (full mirror)
        await destCol.drop().catch(() => { /* collection may not exist */ });
        
        // Insert in batches of 500
        const batchSize = 500;
        let totalInserted = 0;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          const insertResult = await destCol.insertMany(batch, { ordered: false });
          totalInserted += insertResult.insertedCount;
        }

        results[colName] = { copied: totalInserted };
        console.log(`✅ ${colName}: copied ${totalInserted} docs`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results[colName] = { copied: 0, error: msg };
        console.error(`❌ ${colName}: ${msg}`);
      }
    }

    // Also copy indexes for credentialkeys and other important collections
    const indexCollections = ["users", "credentialkeys", "orders", "purchases", "accounts"];
    for (const colName of indexCollections) {
      try {
        const indexes = await sourceDb.collection(colName).indexes();
        for (const idx of indexes) {
          if (idx.name === "_id_") continue; // skip default
          try {
            await destDb.collection(colName).createIndex(idx.key, {
              name: idx.name,
              unique: idx.unique || false,
              sparse: idx.sparse || false,
            });
          } catch (_) { /* index may already exist */ }
        }
      } catch (_) { /* skip index errors */ }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const totalDocs = Object.values(results).reduce((sum, r) => sum + r.copied, 0);
    const errors = Object.entries(results).filter(([_, r]) => r.error).length;

    console.log(`Backup complete: ${totalDocs} total docs across ${COLLECTIONS.length} collections in ${elapsed}s (${errors} errors)`);

    return new Response(
      JSON.stringify({
        success: true,
        source_db: sourceDbName,
        dest_db: destDbName,
        total_docs: totalDocs,
        elapsed_seconds: parseFloat(elapsed),
        errors,
        collections: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("MongoDB backup error:", error);
    return new Response(
      JSON.stringify({ error: "Backup failed", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (sourceClient) try { await sourceClient.close(); } catch (_) {}
    if (destClient) try { await destClient.close(); } catch (_) {}
  }
});
