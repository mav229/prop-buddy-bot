import { SMTPClient } from "npm:emailjs@4.0.3";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { to, cc, subject, body, html, templateId, recipientName } = await req.json();

    if (!to || !subject || (!body && !html)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, body/html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const password = Deno.env.get("SMTP_PASSWORD");
    if (!password) {
      return new Response(
        JSON.stringify({ error: "SMTP_PASSWORD not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate tracking ID
    const trackingId = crypto.randomUUID();
    const trackerBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-tracker`;

    // Inject tracking pixel and click tracking into HTML
    let finalHtml = html || "";
    if (finalHtml) {
      // Replace propscholar.com links with click tracking
      finalHtml = finalHtml.replace(
        /href="https:\/\/propscholar\.com"/g,
        `href="${trackerBase}?id=${trackingId}&action=click"`
      );
      // Add tracking pixel before closing div
      finalHtml += `<img src="${trackerBase}?id=${trackingId}&action=open" width="1" height="1" style="display:none;" />`;
    }

    const client = new SMTPClient({
      user: "team@propscholar.in",
      password,
      host: "smtp.hostinger.com",
      ssl: true,
      port: 465,
    });

    const message = await client.sendAsync({
      from: "PropScholar <team@propscholar.in>",
      to,
      ...(cc ? { cc } : {}),
      subject,
      text: body || "",
      attachment: finalHtml
        ? [{ data: finalHtml, alternative: true }]
        : undefined,
    });

    console.log("Email sent:", message);

    // Log to email_logs
    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await sb.from("email_logs").insert({
        recipient_email: to,
        recipient_name: recipientName || null,
        template_id: templateId || "manual",
        tracking_id: trackingId,
        source: "manual",
      });
    } catch (logErr) {
      console.error("Failed to log email:", logErr);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SMTP error:", error);
    return new Response(
      JSON.stringify({ error: `Failed to send email: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
