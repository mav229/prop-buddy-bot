import { SMTPClient } from "npm:emailjs@4.0.3";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_REVIEW_LINK = "https://g.page/r/CdHO0VDiVc1aEAI/review";
const TRUSTPILOT_LINK = "https://www.trustpilot.com/review/propscholar.com";

const BANNER_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/testimonial-banner.png";
const ICON_IG = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-instagram.png";
const ICON_DC = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-discord.png";
const ICON_X = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-x.png";
const ICON_YT = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-youtube.png";
const ICON_PS = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-propscholar.png";

const EMAIL_SUBJECT = "Share your PropScholar experience";
const SUBTITLE = "Be honest… how did we do? Rate us below 😉";

function buildHtml(name: string) {
  const trackerBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-tracker`;
  const trackingId = crypto.randomUUID();

  return {
    trackingId,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="text-align:center;">
      <img src="${BANNER_URL}" alt="How was your experience?" style="width:100%;max-width:600px;display:block;" />
    </div>
    <div style="padding:36px 28px;text-align:center;">
      <h2 style="font-size:22px;color:#111827;margin:0 0 8px;font-weight:700;">How was your Payout experience?</h2>
      <p style="font-size:14px;color:#777777;margin:0 0 24px;">${SUBTITLE}</p>
      <div style="margin:0 0 28px;">
        <span style="font-size:36px;color:#f5a623;">★ ★ ★ ★ ★</span>
      </div>
      <div style="margin:0 0 14px;">
        <a href="${trackerBase}?id=${trackingId}&action=click&dest=trustpilot" target="_blank" style="display:inline-block;background:#00b67a;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">
          Review Us on Trustpilot
        </a>
      </div>
      <div style="margin:0 0 28px;">
        <a href="${trackerBase}?id=${trackingId}&action=click&dest=google" target="_blank" style="display:inline-block;background:#4285F4;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">
          Review Us on Google
        </a>
      </div>
    </div>
    <div style="background:#0f1729;padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <a href="https://propscholar.com" target="_blank" style="text-decoration:none;"><img src="${ICON_PS}" alt="PropScholar" width="32" height="32" style="border-radius:4px;" /></a>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <a href="https://www.instagram.com/propscholar/" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_IG}" alt="Instagram" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://discord.gg/propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_DC}" alt="Discord" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://x.com/propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_X}" alt="X" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://www.youtube.com/@propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_YT}" alt="YouTube" width="26" height="26" style="border-radius:4px;" /></a>
        </td>
      </tr></table>
    </div>
    <img src="${trackerBase}?id=${trackingId}&action=open" width="1" height="1" style="display:none;" />
  </div>
</body>
</html>`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if automation is enabled
    const { data: settings } = await sb
      .from("testimonial_settings")
      .select("is_enabled")
      .limit(1)
      .single();

    if (!settings?.is_enabled) {
      return new Response(
        JSON.stringify({ message: "Automation is disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find COMPLETED certificates with email but no testimonial sent
    const { data: pending, error: fetchErr } = await sb
      .from("hall_of_fame_certificates")
      .select("id, user_name, email, payout_amount, account_number")
      .eq("status", "COMPLETED")
      .not("email", "is", null)
      .is("testimonial_sent_at", null)
      .limit(10);

    if (fetchErr) throw fetchErr;

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending testimonial emails", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const password = Deno.env.get("SMTP_PASSWORD");
    if (!password) {
      return new Response(
        JSON.stringify({ error: "SMTP_PASSWORD not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new SMTPClient({
      user: "team@propscholar.in",
      password,
      host: "smtp.hostinger.com",
      ssl: true,
      port: 465,
    });

    let sentCount = 0;

    for (const cert of pending) {
      try {
        const { trackingId, html } = buildHtml(cert.user_name);

        await client.sendAsync({
          from: "PropScholar <team@propscholar.in>",
          to: cert.email,
          subject: EMAIL_SUBJECT,
          text: `Hey ${cert.user_name}, share your PropScholar payout experience!`,
          attachment: [{ data: html, alternative: true }],
        });

        // Mark as sent
        await sb
          .from("hall_of_fame_certificates")
          .update({ testimonial_sent_at: new Date().toISOString() })
          .eq("id", cert.id);

        // Log to email_logs
        await sb.from("email_logs").insert({
          recipient_email: cert.email,
          recipient_name: cert.user_name,
          template_id: "testimonial-auto",
          tracking_id: trackingId,
          source: "automation",
        });

        sentCount++;
        console.log(`Testimonial email sent to ${cert.user_name} (${cert.email})`);
      } catch (emailErr) {
        console.error(`Failed to send to ${cert.email}:`, emailErr);
      }
    }

    return new Response(
      JSON.stringify({ message: `Sent ${sentCount} testimonial emails`, sent: sentCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Testimonial automation error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
