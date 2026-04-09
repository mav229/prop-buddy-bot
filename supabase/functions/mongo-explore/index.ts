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
    
    // Count by credentialStatus + isActive combos
    const comboCounts: Record<string, number> = {};
    // Count by phase for ACTIVE
    const phaseCounts: Record<string, number> = {};
    // Count unique users (assignedTo) for ACTIVE
    const activeUsers = new Set<string>();
    // Count isActive values for ACTIVE status
    let activeTrue = 0;
    let activeFalse = 0;
    let activeUndefined = 0;

    for (const doc of credDocs) {
      for (const c of (doc.credentials || [])) {
        const combo = `${c.credentialStatus || "NONE"}|isActive=${c.isActive}`;
        comboCounts[combo] = (comboCounts[combo] || 0) + 1;
        
        if (c.credentialStatus === "ACTIVE") {
          const phase = c.phase || "NO_PHASE";
          phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
          if (c.assignedTo) activeUsers.add(c.assignedTo);
          if (c.isActive === true) activeTrue++;
          else if (c.isActive === false) activeFalse++;
          else activeUndefined++;
        }
      }
    }

    // Check credentialkeys doc-level status
    const docStatuses: Record<string, number> = {};
    for (const doc of credDocs) {
      const s = (doc as any).status || (doc as any).keyStatus || "NO_DOC_STATUS";
      docStatuses[s] = (docStatuses[s] || 0) + 1;
    }

    await client.close();

    return new Response(JSON.stringify({
      statusIsActiveCombos: comboCounts,
      activePhases: phaseCounts,
      uniqueActiveUsers: activeUsers.size,
      activeIsActive: { true: activeTrue, false: activeFalse, undefined: activeUndefined },
      docLevelStatuses: docStatuses,
      totalCredDocs: credDocs.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    if (client) try { await client.close(); } catch (_) {}
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
