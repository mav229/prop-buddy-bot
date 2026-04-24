import { MongoClient } from "npm:mongodb@6.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account, mode } = await req.json();
    const uri = Deno.env.get("MONGO_URI")!;
    const dbName = Deno.env.get("MONGO_DB_NAME")!;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    if (mode === "collections") {
      const cols = await db.listCollections().toArray();
      await client.close();
      return new Response(JSON.stringify(cols.map(c => c.name)), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "find_open") {
      // Search every collection for a doc that mentions one of our position_ids
      const positionIds = [1939496650, 1937262584, 1942089999]; // ETH avg pair + another
      const cols = await db.listCollections().toArray();
      const results: Record<string, any> = {};
      for (const c of cols) {
        try {
          const sample = await db.collection(c.name).findOne({ $or: [
            { position_id: { $in: positionIds } },
            { positionId: { $in: positionIds } },
            { ticket: { $in: positionIds } },
          ]});
          if (sample) {
            results[c.name] = { keys: Object.keys(sample), sample };
          }
        } catch {}
      }
      await client.close();
      return new Response(JSON.stringify(results, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accNum = Number(account);
    const report = await db.collection("credentials_reports").findOne(
      { account: accNum },
      { projection: { account: 1, name: 1, "tradeHistory.deals": 1 } },
    );
    await client.close();

    if (!report) {
      return new Response(JSON.stringify({ error: "Not found", account }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        account: report.account,
        name: report.name,
        deals: report.tradeHistory?.deals || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
