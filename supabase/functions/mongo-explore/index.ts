import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.includes(serviceRoleKey) && !authHeader.includes(anonKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const mongoUri = Deno.env.get("MONGO_URI");
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  if (!mongoUri) return new Response(JSON.stringify({ error: "No MONGO_URI" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  let client: MongoClient | null = null;
  try {
    const body = await req.json();
    const { action, account } = body;

    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    if (action === "list") {
      const colls = await db.listCollections().toArray();
      const result: any[] = [];
      for (const c of colls) {
        const count = await db.collection(c.name).estimatedDocumentCount();
        result.push({ name: c.name, count });
      }
      await client.close();
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "sample") {
      const { collection, query } = body;
      const docs = await db.collection(collection).find(query || {}).limit(3).toArray();
      await client.close();
      return new Response(JSON.stringify({ collection, count: docs.length, docs }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "check_trades") {
      // Check credentials_reports for trade/deal data
      const report = await db.collection("credentials_reports").findOne({ account: parseInt(account) });
      const reportKeys = report ? Object.keys(report) : [];
      
      // Check violations for this account
      const violations = await db.collection("violations").find({ $or: [{ account: parseInt(account) }, { accountNumber: parseInt(account) }] }).limit(5).toArray();
      
      // List all collections
      const colls = await db.listCollections().toArray();
      const collNames = colls.map((c: any) => c.name);
      
      // Check trade-related collections
      const tradeKeywords = ["deal", "trade", "position", "history", "mt5", "execution"];
      const tradeColls = collNames.filter((n: string) => tradeKeywords.some(k => n.toLowerCase().includes(k)));
      
      // Sample each trade collection
      const tradeSamples: any = {};
      for (const tc of tradeColls) {
        const sample = await db.collection(tc).findOne();
        tradeSamples[tc] = sample ? Object.keys(sample) : "empty";
      }

      await client.close();
      return new Response(JSON.stringify({
        allCollections: collNames,
        tradeCollections: tradeColls,
        tradeSamples,
        reportKeys,
        reportArrayFields: reportKeys.filter(k => report && Array.isArray(report[k])).map(k => ({ key: k, length: report[k].length, sample: JSON.stringify(report[k][0])?.slice(0, 300) })),
        violations: violations.length,
        violationSample: violations[0] ? Object.keys(violations[0]) : []
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await client.close();
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (client) try { await client.close(); } catch (_) {}
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
