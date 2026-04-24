import { MongoClient } from "npm:mongodb@6.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { account } = await req.json();
    if (!account) {
      return new Response(JSON.stringify({ error: "account required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uri = Deno.env.get("MONGO_URI")!;
    const dbName = Deno.env.get("MONGO_DB_NAME")!;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

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
