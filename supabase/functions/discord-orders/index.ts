import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function isAdmin(req: Request): Promise<boolean> {
  // Check service role key first
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey)) {
    return true;
  }

  // Check if user is admin via Supabase auth
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!authHeader) return false;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return data === true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await isAdmin(req))) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const uri = Deno.env.get("MONGO_URI");
  if (!uri) {
    return new Response(
      JSON.stringify({ error: "MONGO_URI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  let client: MongoClient | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const skip = body.skip || 0;

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    const orders = await db.collection("orders")
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection("orders").countDocuments({});

    // Map orders - include all raw fields so we can discover the schema on first load
    const mapped = orders.map((order: any) => {
      return {
        _id: order._id?.toString(),
        // Customer name - try common patterns
        customerName: order.customerName || order.customer_name || order.userName || order.user_name || order.name || order.buyerName || order.fullName || order.customer?.name || "",
        // Account size
        accountSize: order.accountSize || order.account_size || order.variantName || order.variant_name || order.variant?.name || order.productName || order.product_name || order.product?.name || order.title || "",
        // Payment method
        paymentMethod: order.paymentMethod || order.payment_method || order.gateway || order.paymentGateway || order.payment_gateway || order.method || "",
        // Extra useful fields
        status: order.status || order.orderStatus || "",
        amount: order.amount || order.total || order.totalAmount || order.price || 0,
        email: order.email || order.customerEmail || order.customer_email || order.userEmail || "",
        createdAt: order.createdAt || order.created_at || order.date || "",
        // Raw keys for schema discovery
        _rawKeys: Object.keys(order),
        _raw: order,
      };
    });

    return new Response(JSON.stringify({ orders: mapped, total }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Discord orders error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch orders" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (client) {
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
});
