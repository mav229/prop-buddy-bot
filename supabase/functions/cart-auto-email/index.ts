import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { MongoClient } from "npm:mongodb@6.12.0";
import { SMTPClient } from "npm:emailjs@4.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- Email templates (server-side copy) ----------

const BANNER_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/cart-banner.png";
const TRACKER_BASE = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/email-tracker";

interface Tpl { id: string; subject: (n: string) => string; buildHtml: (n: string, c: number, tid: string) => string; }

const cta = (trackingId: string) => `
<div style="text-align:center;margin:32px 0 0;">
  <a href="${TRACKER_BASE}?id=${trackingId}&action=click" style="background:#4A90D9;color:#fff;padding:14px 44px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;letter-spacing:.3px;">Complete Your Purchase</a>
</div>`;

const wrap = (content: string, trackingId: string) => `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#fff;">
  <div style="width:100%;overflow:hidden;"><img src="${BANNER_URL}" alt="PropScholar" style="width:100%;display:block;"/></div>
  <div style="padding:40px 36px;">
    ${content}
    <div style="height:1px;background:#e5e7eb;margin:32px 0;"></div>
    <p style="color:#9ca3af;font-size:13px;line-height:1.7;margin:0 0 16px;">Got questions? Just reply to this email — our team has your back.</p>
    <p style="color:#9ca3af;font-size:13px;margin:0;">Warm regards,<br/><strong style="color:#6b7280;">Team PropScholar</strong></p>
  </div>
  <img src="${TRACKER_BASE}?id=${trackingId}&action=open" width="1" height="1" style="display:none;" />
</div>`;

const templates: Tpl[] = [
  {
    id: "friendly-nudge",
    subject: (n) => `Hey ${n}, you left something behind 👋`,
    buildHtml: (fn, ci, tid) => wrap(`
      <h2 style="color:#111827;font-size:24px;font-weight:700;margin:0 0 20px;">Hey ${fn},</h2>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 12px;">Life gets busy — we get it. But you left <strong style="color:#111827;">${ci} item${ci>1?"s":""}</strong> in your cart.</p>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 8px;">${ci>1?"They're":"It's"} still waiting for you. Your trading journey is just one click away.</p>
      ${cta(tid)}`, tid),
  },
  {
    id: "bold-direct",
    subject: (n) => `${n}, finish what you started 💪`,
    buildHtml: (fn, ci, tid) => wrap(`
      <h2 style="color:#111827;font-size:24px;font-weight:700;margin:0 0 20px;">No Excuses, ${fn}.</h2>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 12px;">You picked <strong style="color:#111827;">${ci} item${ci>1?"s":""}</strong> because you knew ${ci>1?"they were":"it was"} exactly what you needed.</p>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 8px;">Winners don't leave things half-done. Your future self will thank you.</p>
      ${cta(tid)}`, tid),
  },
  {
    id: "smooth-closer",
    subject: (n) => `${n}, your picks are still saved ✨`,
    buildHtml: (fn, ci, tid) => wrap(`
      <h2 style="color:#111827;font-size:24px;font-weight:700;margin:0 0 20px;">Good news, ${fn}.</h2>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 12px;">We saved your <strong style="color:#111827;">${ci} item${ci>1?"s":""}</strong> so you don't have to start over. Smart choices deserve a smooth checkout.</p>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 8px;">One click and ${ci>1?"they're":"it's"} yours. Easy as that.</p>
      ${cta(tid)}`, tid),
  },
  {
    id: "hype-king",
    subject: (n) => `${n}, start your trading journey now 🔥`,
    buildHtml: (fn, ci, tid) => wrap(`
      <h2 style="color:#111827;font-size:24px;font-weight:700;margin:0 0 20px;">Real talk, ${fn}.</h2>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 12px;">Those <strong style="color:#111827;">${ci} item${ci>1?"s":""}</strong> you picked? Absolute fire. You clearly know what you want — now go get it.</p>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 8px;">The best traders don't hesitate. Lock it in and level up.</p>
      ${cta(tid)}`, tid),
  },
  {
    id: "chill-vibes",
    subject: (n) => `Just checking in, ${n} 🙌`,
    buildHtml: (fn, ci, tid) => wrap(`
      <h2 style="color:#111827;font-size:24px;font-weight:700;margin:0 0 20px;">Quick check-in, ${fn}.</h2>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 12px;">No pressure at all — just wanted to let you know your <strong style="color:#111827;">${ci} item${ci>1?"s are":" is"}</strong> still in your cart whenever you're ready.</p>
      <p style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 8px;">We're here if you need anything. Take your time, we've got you.</p>
      ${cta(tid)}`, tid),
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  const mongoUri = Deno.env.get("MONGO_URI");
  const smtpPass = Deno.env.get("SMTP_PASSWORD");
  if (!mongoUri || !smtpPass) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let mongoClient: MongoClient | null = null;
  const results: string[] = [];

  try {
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    const db = mongoClient.db(Deno.env.get("MONGO_DB_NAME") || "test");

    // 1. Get carts older than 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const usersWithCart = await db.collection("users").find({
      cart: { $exists: true, $not: { $size: 0 } },
      updatedAt: { $lt: twoHoursAgo },
    }).project({ _id: 1, name: 1, email: 1, cart: 1 }).limit(100).toArray();

    if (usersWithCart.length === 0) {
      return new Response(JSON.stringify({ message: "No carts older than 2hrs", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Filter out users who already paid
    const emails = usersWithCart.map((u: any) => u.email?.toLowerCase()).filter(Boolean);
    const userIds = usersWithCart.map((u: any) => u._id);

    const paidOrders = await db.collection("orders").find({
      $or: [
        { email: { $in: emails } },
        { userId: { $in: userIds } },
        { user: { $in: userIds } },
      ],
      $and: [{
        $or: [
          { status: { $in: ["completed", "paid", "delivered", "processing", "confirmed"] } },
          { paymentStatus: { $in: ["paid", "completed", "success"] } },
          { isPaid: true },
        ]
      }]
    }).project({ email: 1, userId: 1, user: 1 }).toArray();

    const paidEmails = new Set<string>();
    for (const o of paidOrders) { if (o.email) paidEmails.add(o.email.toLowerCase()); }

    const abandoned = usersWithCart.filter((u: any) => !paidEmails.has(u.email?.toLowerCase()));

    // 3. Check which emails were already sent in last 24hrs (avoid spamming)
    const { data: recentLogs } = await sb.from("email_logs")
      .select("recipient_email")
      .gte("sent_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const recentlySent = new Set((recentLogs || []).map((l: any) => l.recipient_email.toLowerCase()));

    const toSend = abandoned.filter((u: any) => !recentlySent.has(u.email?.toLowerCase()));

    if (toSend.length === 0) {
      return new Response(JSON.stringify({ message: "All eligible users already emailed in last 24hrs", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Send emails
    const smtp = new SMTPClient({
      user: "team@propscholar.in",
      password: smtpPass,
      host: "smtp.hostinger.com",
      ssl: true,
      port: 465,
    });

    for (const user of toSend) {
      try {
        const email = user.email;
        const firstName = (user.name || "").split(" ")[0] || "there";
        const cartItems = (user.cart || []).length;
        
        // Random template
        const tpl = templates[Math.floor(Math.random() * templates.length)];
        const trackingId = crypto.randomUUID();
        const html = tpl.buildHtml(firstName, cartItems, trackingId);
        const subject = tpl.subject(firstName);

        await smtp.sendAsync({
          from: "PropScholar <team@propscholar.in>",
          to: email,
          subject,
          text: "",
          attachment: [{ data: html, alternative: true }],
        });

        // Log to db
        await sb.from("email_logs").insert({
          recipient_email: email,
          recipient_name: user.name || null,
          template_id: tpl.id,
          tracking_id: trackingId,
          source: "auto_cart_2hr",
        });

        results.push(`Sent "${tpl.id}" to ${email}`);
      } catch (e) {
        console.error(`Failed to send to ${user.email}:`, e);
        results.push(`FAILED: ${user.email} - ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ sent: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Cart auto-email error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (mongoClient) try { await mongoClient.close(); } catch (_) {}
  }
});
