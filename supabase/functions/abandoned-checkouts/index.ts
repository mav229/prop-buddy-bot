import { MongoClient } from "npm:mongodb@6.12.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify caller is admin via Supabase auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
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
    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    // Find users who have items in their cart (non-empty cart array)
    const usersWithCart = await db.collection("users").find({
      cart: { $exists: true, $not: { $size: 0 } }
    }).project({
      _id: 1,
      name: 1,
      email: 1,
      phone: 1,
      cart: 1,
      createdAt: 1,
      updatedAt: 1,
    }).limit(500).toArray();

    if (usersWithCart.length === 0) {
      return new Response(
        JSON.stringify({ abandoned: [], total: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all user emails to check which ones have completed orders
    const emails = usersWithCart.map((u: any) => u.email?.toLowerCase()).filter(Boolean);
    const userIds = usersWithCart.map((u: any) => u._id);

    // Find users who HAVE completed orders (paid)
    const paidOrders = await db.collection("orders").find({
      $or: [
        { email: { $in: emails } },
        { userId: { $in: userIds } },
        { user: { $in: userIds } },
      ],
      // Orders with status indicating payment completed
      $and: [
        {
          $or: [
            { status: { $in: ["completed", "paid", "delivered", "processing", "confirmed"] } },
            { paymentStatus: { $in: ["paid", "completed", "success"] } },
            { isPaid: true },
          ]
        }
      ]
    }).project({ email: 1, userId: 1, user: 1 }).toArray();

    // Build set of emails/userIds that have paid
    const paidEmails = new Set<string>();
    const paidUserIds = new Set<string>();
    for (const order of paidOrders) {
      if (order.email) paidEmails.add(order.email.toLowerCase());
      if (order.userId) paidUserIds.add(order.userId.toString());
      if (order.user) paidUserIds.add(order.user.toString());
    }

    // Filter to only users who have NOT paid
    const abandoned = usersWithCart.filter((u: any) => {
      const email = u.email?.toLowerCase();
      const id = u._id?.toString();
      return !paidEmails.has(email) && !paidUserIds.has(id);
    }).map((u: any) => ({
      id: u._id?.toString(),
      name: u.name || "Unknown",
      email: u.email || "",
      phone: u.phone || "",
      cartItems: (u.cart || []).length,
      cartDetails: (u.cart || []).map((item: any) => ({
        product: item.product?.toString(),
        variant: item.variant?.toString(),
        quantity: item.quantity || 1,
      })),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    return new Response(
      JSON.stringify({ abandoned, total: abandoned.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Abandoned checkouts error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch abandoned checkouts" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (client) {
      try { await client.close(); } catch (_) { /* ignore */ }
    }
  }
});
