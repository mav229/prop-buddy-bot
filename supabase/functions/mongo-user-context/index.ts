import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function safeArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const uri = Deno.env.get("MONGO_URI");
  if (!uri) {
    return new Response(
      JSON.stringify({ error: "MONGO_URI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const dbName = Deno.env.get("MONGO_DB_NAME") || "propscholar";
  let client: MongoClient | null = null;

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Valid email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    // 1. Find user by email
    const user = await db.collection("users").findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return new Response(
        JSON.stringify({ user: null, accounts: [], violations: [], tickets: [], purchases: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user._id;

    // 2. Fetch all related data in parallel
    const [accounts, violations, tickets, purchases] = await Promise.all([
      db.collection("accounts").find({ userId }).toArray().catch(() => []),
      db.collection("violations").find({ userId }).toArray().catch(() => []),
      db.collection("tickets").find({ userId }).toArray().catch(() => []),
      db.collection("purchases").find({ userId }).toArray().catch(() => []),
    ]);

    const result = {
      user,
      accounts: safeArray(accounts),
      violations: safeArray(violations),
      tickets: safeArray(tickets),
      purchases: safeArray(purchases),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("MongoDB user context error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user context" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (client) {
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
});
