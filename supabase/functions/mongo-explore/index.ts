import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const pubKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.includes(serviceRoleKey) && !authHeader.includes(anonKey) && !authHeader.includes(pubKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const mongoUri = Deno.env.get("MONGO_URI");
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  if (!mongoUri) return new Response(JSON.stringify({ error: "No MONGO_URI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    // Count credential statuses
    const credDocs = await db.collection("credentialkeys").find({}, { projection: { credentials: 1 } }).toArray();
    
    const statusCounts: Record<string, number> = {};
    const sampleFields: string[] = [];
    let sampleCred: any = null;
    
    for (const doc of credDocs) {
      for (const c of (doc.credentials || [])) {
        const status = c.credentialStatus || "NO_STATUS";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        if (!sampleCred && status === "ACTIVE") {
          sampleCred = c;
        }
      }
    }

    // Also check accounts collection
    const accountSample = await db.collection("accounts").findOne();
    const accountKeys = accountSample ? Object.keys(accountSample) : [];
    const accountCount = await db.collection("accounts").estimatedDocumentCount();

    // Check if accounts have status field
    const accountStatuses: Record<string, number> = {};
    if (accountSample && ("status" in accountSample || "accountStatus" in accountSample)) {
      const accounts = await db.collection("accounts").find({}, { projection: { status: 1, accountStatus: 1 } }).toArray();
      for (const a of accounts) {
        const s = a.status || a.accountStatus || "NONE";
        accountStatuses[s] = (accountStatuses[s] || 0) + 1;
      }
    }

    await client.close();

    return new Response(JSON.stringify({
      credentialStatusCounts: statusCounts,
      sampleActiveCredentialKeys: sampleCred ? Object.keys(sampleCred) : [],
      sampleActiveCredential: sampleCred,
      accountsCollection: { count: accountCount, sampleKeys: accountKeys, statusCounts: accountStatuses }
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (client) try { await client.close(); } catch (_) {}
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
