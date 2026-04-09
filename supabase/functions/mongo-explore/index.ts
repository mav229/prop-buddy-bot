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

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(mongoUri!);
    await client.connect();
    const db = client.db(dbName);

    const credDocs = await db.collection("credentialkeys").find({}, { projection: { credentials: 1, name: 1 } }).toArray();
    
    // Count unique loginIds with ACTIVE status
    const activeLoginIds = new Set<string>();
    const allLoginIds = new Set<string>();
    const statusByLogin = new Map<string, string[]>();
    
    for (const doc of credDocs) {
      for (const c of (doc.credentials || [])) {
        if (!c.loginId) continue;
        const lid = String(c.loginId);
        allLoginIds.add(lid);
        
        if (!statusByLogin.has(lid)) statusByLogin.set(lid, []);
        statusByLogin.get(lid)!.push(c.credentialStatus || "NONE");
        
        if (c.credentialStatus === "ACTIVE") {
          activeLoginIds.add(lid);
        }
      }
    }

    // Check how many loginIds appear in multiple docs
    const duplicateCount = Array.from(statusByLogin.values()).filter(v => v.length > 1).length;
    
    // Check how many have mixed statuses (e.g. ACTIVE in one doc, BREACHED in another)
    const mixedStatus = Array.from(statusByLogin.entries()).filter(([_, statuses]) => {
      const unique = new Set(statuses);
      return unique.size > 1;
    });

    // Check credentials_reports count for ACTIVE loginIds
    const activeIds = Array.from(activeLoginIds).map(Number);
    const reportsCount = await db.collection("credentials_reports")
      .countDocuments({ account: { $in: activeIds } });

    // Count reports with tradeHistory
    const reportsWithTrades = await db.collection("credentials_reports")
      .countDocuments({ account: { $in: activeIds }, "tradeHistory.totalDeals": { $gt: 0 } });

    await client.close();

    return new Response(JSON.stringify({
      totalUniqueLoginIds: allLoginIds.size,
      uniqueActiveLoginIds: activeLoginIds.size,
      duplicateLoginIds: duplicateCount,
      mixedStatusCount: mixedStatus.length,
      mixedStatusSample: mixedStatus.slice(0, 5).map(([lid, s]) => ({ loginId: lid, statuses: s })),
      reportsForActive: reportsCount,
      reportsWithTradeHistory: reportsWithTrades,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (client) try { await client.close(); } catch (_) {}
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
