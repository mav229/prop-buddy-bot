import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function isAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader && serviceRoleKey && authHeader.includes(serviceRoleKey)) {
    return true;
  }

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
    const statusFilter = body.status || null; // optional filter

    client = new MongoClient(uri);
    await client.connect();
    const db = client.db(dbName);

    // Build query
    const query: any = {};
    if (statusFilter) {
      query.status = statusFilter;
    }

    const orders = await db.collection("orders")
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection("orders").countDocuments(query);

    // Try to resolve Discord IDs from discord_connections via email
    const emails = orders
      .map((o: any) => o.customerDetails?.email?.toLowerCase())
      .filter(Boolean);

    let discordMap: Record<string, { discord_user_id: string; discord_username: string | null }> = {};
    if (emails.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: connections } = await supabase
        .from("discord_connections")
        .select("email, discord_user_id, discord_username")
        .in("email", [...new Set(emails)]);
      
      if (connections) {
        for (const c of connections) {
          discordMap[c.email.toLowerCase()] = {
            discord_user_id: c.discord_user_id,
            discord_username: c.discord_username,
          };
        }
      }
    }

    // Map orders with correct field paths
    const mapped = orders.map((order: any) => {
      const cd = order.customerDetails || {};
      const pd = order.paymentDetails || {};
      const email = (cd.email || "").toLowerCase();
      const discord = discordMap[email] || null;

      // Extract payment method from gateway response
      const gwPayment = pd.gatewayResponse?.data?.payment || {};
      const paymentGroup = gwPayment.payment_group || "";
      const paymentMethod = paymentGroup || pd.paymentMethod || pd.method || "";

      // Amount: paymentDetails.amount is in paise for INR, convert to rupees
      const currency = pd.currency || "USD";
      let amount = pd.amount || gwPayment.payment_amount || 0;
      if (currency === "INR" && amount > 10000) {
        amount = Math.round(amount / 100);
      }

      // Extract account size from item price
      const firstItem = order.items?.[0];
      const itemPrice = firstItem?.price || firstItem?.totalPrice || amount;
      // Map common price points to account sizes
      const accountSize = mapPriceToAccountSize(itemPrice, currency);

      return {
        _id: order._id?.toString(),
        orderNumber: order.orderNumber || "",
        customerName: cd.name || "",
        email: cd.email || "",
        phone: cd.phone || "",
        paymentMethod: paymentMethod.toUpperCase(),
        status: order.status || "",
        amount,
        currency,
        accountSize,
        itemCount: order.items?.length || 0,
        discordUserId: discord?.discord_user_id || null,
        discordUsername: discord?.discord_username || null,
        createdAt: order.createdAt || "",
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
