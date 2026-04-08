import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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

async function getChannelIds(): Promise<string[]> {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    const { data } = await supabase
      .from("widget_config")
      .select("config")
      .eq("id", "cert_announce_channel")
      .maybeSingle();
    if (!data?.config || typeof data.config !== "object") return [];
    const cfg = data.config as Record<string, string>;
    const ids: string[] = [];
    if (cfg.channel_id_1 || cfg.channel_id) ids.push(cfg.channel_id_1 || cfg.channel_id);
    if (cfg.channel_id_2) ids.push(cfg.channel_id_2);
    return ids.filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function sendOrderToDiscord(
  botToken: string,
  channelIds: string[],
  order: { customer_name: string; account_size: string; payment_method: string }
) {
  const embed = {
    title: "🛒 New Order Confirmed!",
    description: `**${order.customer_name}** has purchased a PropScholar account!`,
    color: 0x3b82f6,
    fields: [
      { name: "Customer", value: order.customer_name, inline: true },
      { name: "Account Size", value: order.account_size, inline: true },
      { name: "Payment Method", value: order.payment_method, inline: true },
    ],
    footer: { text: "PropScholar Orders" },
    timestamp: new Date().toISOString(),
  };
  for (const channelId of channelIds) {
    try {
      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ embeds: [embed] }),
        }
      );
      if (!res.ok) {
        console.error(`Real order push failed ch:${channelId} (${res.status}):`, await res.text());
      } else {
        console.log(`Real order pushed: ${order.customer_name} to ${channelId}`);
      }
    } catch (e) {
      console.error(`Real order push error ch:${channelId}:`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function extractAccountSizeFromItem(item: any): string | null {
  // Try to extract account size from ALL text fields on the item
  const text = [
    item?.name, item?.title, item?.productName, item?.description,
    item?.variant, item?.variantName, item?.sku, item?.slug,
    item?.product?.name, item?.product?.title,
  ]
    .filter(Boolean)
    .join(" ");
  
  if (!text) return null;

  // Match patterns like "$5K", "5k", "5K", "$5 K"
  const match = text.match(/\$?(200|100|50|25|10|5|2)\s*[kK]/i);
  if (match) return `$${match[1]}K`;
  
  // Match full amounts like "200000" or "2000"
  const fullMatch = text.match(/(200000|100000|50000|25000|10000|5000|2000)/);
  if (fullMatch) {
    const map: Record<string, string> = { "200000": "$200K", "100000": "$100K", "50000": "$50K", "25000": "$25K", "10000": "$10K", "5000": "$5K", "2000": "$2K" };
    return map[fullMatch[1]] || null;
  }
  
  return null;
}

function mapPriceToAccountSize(price: number, currency: string): string {
  // INR pricing (Cashfree gateway, amounts in rupees)
  if (currency === "INR") {
    if (price <= 400) return "$2K";
    if (price <= 900) return "$5K";
    if (price <= 1800) return "$10K";
    if (price <= 4000) return "$25K";
    if (price <= 8000) return "$50K";
    if (price <= 16000) return "$100K";
    return "$200K";
  }
  // USD / crypto pricing
  if (price <= 8) return "$2K";
  if (price <= 20) return "$5K";
  if (price <= 45) return "$10K";
  if (price <= 90) return "$25K";
  if (price <= 180) return "$50K";
  if (price <= 400) return "$100K";
  return "$200K";
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

  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  let client: MongoClient | null = null;

  try {
    const body = await req.json().catch(() => ({}));

    // === AUTO PUSH MODE (called by cron) ===
    if (body?.action === "auto_push") {
      const botToken = Deno.env.get("DISCORD_BOT_TOKEN");
      const channelIds = await getChannelIds();
      if (!botToken || channelIds.length === 0) {
        return new Response(JSON.stringify({ skipped: true, reason: "Bot or channels not configured" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      client = new MongoClient(uri);
      await client.connect();
      const db = client.db(dbName);

      const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const confirmedOrders = await db.collection("orders")
        .find({ status: { $in: ["confirmed", "completed", "paid", "fulfilled"] }, createdAt: { $gte: cutoff } })
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      if (confirmedOrders.length === 0) {
        return new Response(JSON.stringify({ pushed: 0, message: "No recent confirmed orders" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mongoIds = confirmedOrders.map((o: any) => o._id?.toString()).filter(Boolean);
      const { data: alreadyPushed } = await supabase.from("pushed_orders").select("mongo_order_id").in("mongo_order_id", mongoIds);
      const pushedSet = new Set((alreadyPushed || []).map((r: any) => r.mongo_order_id));
      const newOrders = confirmedOrders.filter((o: any) => !pushedSet.has(o._id?.toString()));

      let pushCount = 0;
      for (const order of newOrders) {
        const cd = order.customerDetails || {};
        const pd = order.paymentDetails || {};
        const gwPayment = pd.gatewayResponse?.data?.payment || {};
        const pm = (gwPayment.payment_group || pd.paymentMethod || pd.method || "").toUpperCase();
        const currency = pd.currency || "USD";
        let amount = pd.amount || gwPayment.payment_amount || 0;
        if (currency === "INR" && amount > 10000) amount = Math.round(amount / 100);
        const firstItem = order.items?.[0];
        const itemPrice = firstItem?.price || firstItem?.totalPrice || amount;
        const extractedSize = extractAccountSizeFromItem(firstItem);
        const mappedSize = mapPriceToAccountSize(itemPrice, currency);
        const accountSize = extractedSize || mappedSize;
        console.log(`ORDER DEBUG [${cd.name}]: currency=${currency}, rawAmount=${pd.amount}, amount=${amount}, itemPrice=${itemPrice}, itemName=${firstItem?.name || firstItem?.title || 'N/A'}, extractedSize=${extractedSize}, mappedSize=${mappedSize}, finalSize=${accountSize}`);
        const customerName = cd.name || "Unknown";

        await sendOrderToDiscord(botToken, channelIds, { customer_name: customerName, account_size: accountSize, payment_method: pm || "N/A" });
        await supabase.from("pushed_orders").insert({ mongo_order_id: order._id?.toString(), order_number: order.orderNumber || "", customer_name: customerName, account_size: accountSize, payment_method: pm });
        pushCount++;
        if (newOrders.length > 1) await new Promise((r) => setTimeout(r, 1000));
      }

      console.log(`Auto-pushed ${pushCount} real orders to Discord`);
      return new Response(JSON.stringify({ pushed: pushCount, total_checked: confirmedOrders.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // === ADMIN LIST MODE ===
    if (!(await isAdmin(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Get pushed status
    const orderIds = orders.map((o: any) => o._id?.toString()).filter(Boolean);
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: pushedData } = await supabaseAdmin.from("pushed_orders").select("mongo_order_id").in("mongo_order_id", orderIds);
    const pushedMap: Record<string, boolean> = {};
    for (const p of (pushedData || [])) pushedMap[p.mongo_order_id] = true;

    // Try to resolve Discord IDs
    const emails = orders
      .map((o: any) => o.customerDetails?.email?.toLowerCase())
      .filter(Boolean);

    let discordMap: Record<string, { discord_user_id: string; discord_username: string | null }> = {};
    if (emails.length > 0) {
      const { data: connections } = await supabaseAdmin
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

      // Extract account size from item name first, then fall back to price mapping
      const firstItem = order.items?.[0];
      const itemPrice = firstItem?.price || firstItem?.totalPrice || amount;
      const accountSize = extractAccountSizeFromItem(firstItem) || mapPriceToAccountSize(itemPrice, currency);

      return {
        _id: order._id?.toString(),
        pushed: !!pushedMap[order._id?.toString()],
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
