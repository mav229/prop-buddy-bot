import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require service role key
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authHeader || !serviceRoleKey || !authHeader.includes(serviceRoleKey)) {
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
    const action = body.action || "list";

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    if (action === "schema_sample") {
      // Return a sample order to discover field names
      const sample = await db.collection("orders").findOne({}, { sort: { _id: -1 } });
      return new Response(JSON.stringify({ sample }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch recent orders
    const limit = Math.min(body.limit || 50, 200);
    const skip = body.skip || 0;

    const orders = await db.collection("orders")
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Also get total count
    const total = await db.collection("orders").countDocuments({});

    // Map orders to extract relevant fields
    // We'll try common field name patterns
    const mapped = orders.map((order: any) => {
      // Customer name
      const customerName = order.customerName || order.customer_name || order.userName || order.user_name || order.name || order.buyerName || order.fullName || "";

      // Account size - could be in variant, product name, or a dedicated field
      const accountSize = order.accountSize || order.account_size || order.variantName || order.variant_name || order.productName || order.product_name || order.title || "";

      // Payment method
      const paymentMethod = order.paymentMethod || order.payment_method || order.gateway || order.paymentGateway || order.payment_gateway || order.method || "";

      // Status
      const status = order.status || order.orderStatus || order.order_status || "";

      // Amount
      const amount = order.amount || order.total || order.totalAmount || order.price || 0;

      // Date
      const createdAt = order.createdAt || order.created_at || order.date || order.orderDate || "";

      // Email
      const email = order.email || order.customerEmail || order.customer_email || order.userEmail || "";

      return {
        _id: order._id?.toString(),
        customerName,
        accountSize,
        paymentMethod,
        status,
        amount,
        email,
        createdAt,
        // Include raw keys for debugging schema
        _rawKeys: Object.keys(order),
      };
    });

    return new Response(JSON.stringify({ orders: mapped, total, rawSample: orders[0] ? Object.keys(orders[0]) : [] }), {
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
