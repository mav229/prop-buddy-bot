import { MongoClient } from "npm:mongodb@6.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { mode } = await req.json();
    const uri = Deno.env.get("MONGO_URI")!;
    const dbName = Deno.env.get("MONGO_DB_NAME")!;
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    if (mode === "deep_search") {
      // Look at the credentials_reports doc more deeply for any field with open/entry data
      const report = await db.collection("credentials_reports").findOne({ account: 279579297 });
      await client.close();
      if (!report) return new Response(JSON.stringify({ error: "no" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      
      // Recursively find any key that contains 'open' or 'entry' or 'positions'
      const found: any[] = [];
      function walk(obj: any, path: string) {
        if (obj === null || obj === undefined) return;
        if (typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
          if (obj.length > 0) walk(obj[0], path + '[0]');
          return;
        }
        for (const k of Object.keys(obj)) {
          const lower = k.toLowerCase();
          if (lower.includes('open') || lower.includes('position') || lower.includes('entry')) {
            found.push({ path: path + '.' + k, sample: typeof obj[k] === 'object' ? (Array.isArray(obj[k]) ? `Array(${obj[k].length})` : Object.keys(obj[k]).slice(0,10)) : obj[k] });
          }
          if (typeof obj[k] === 'object' && path.split('.').length < 4) walk(obj[k], path + '.' + k);
        }
      }
      walk(report, '');
      return new Response(JSON.stringify({ topKeys: Object.keys(report), found }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "tradehistory_check") {
      // Maybe there's a separate tradeHistory subdoc with non-OUT entries
      const report = await db.collection("credentials_reports").findOne(
        { account: 279579297 },
        { projection: { tradeHistory: 1, summary: 1 } }
      );
      await client.close();
      const th = report?.tradeHistory;
      const entryCounts: Record<string, number> = {};
      for (const d of (th?.deals || [])) {
        const k = `${d.entry}_${d.entry_name}`;
        entryCounts[k] = (entryCounts[k] || 0) + 1;
      }
      return new Response(JSON.stringify({ tradeHistoryKeys: th ? Object.keys(th) : [], totalDeals: th?.totalDeals, dealsLength: th?.deals?.length, entryCounts, summary: th?.summary }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown mode" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
