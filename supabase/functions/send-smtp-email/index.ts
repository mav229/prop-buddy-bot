import { createTransport } from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FROM_EMAIL = "PropScholar <team@propscholar.in>";

async function sendEmail(
  to: string,
  cc: string | undefined,
  subject: string,
  textBody: string,
  htmlContent: string | undefined,
  maxRetries = 2,
) {
  const password = Deno.env.get("SMTP_PASSWORD");
  if (!password) {
    throw new Error("SMTP_PASSWORD not configured");
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const transporter = createTransport({
        host: "smtp.hostinger.com",
        port: 465,
        secure: true,
        auth: {
          user: "team@propscholar.in",
          pass: password,
        },
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
      });

      const info = await transporter.sendMail({
        from: FROM_EMAIL,
        to,
        ...(cc ? { cc } : {}),
        subject,
        text: textBody,
        ...(htmlContent ? { html: htmlContent } : {}),
      });

      console.log(`[SMTP] Sent successfully on attempt ${attempt + 1}:`, info.messageId);
      return { provider: "smtp", result: info };
    } catch (error) {
      lastError = error;
      console.error(`[SMTP] Attempt ${attempt + 1} failed:`, error instanceof Error ? error.message : error);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("SMTP send failed");
}

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
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, body/html" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trackingId = crypto.randomUUID();
    const trackerBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-tracker`;

    let finalHtml = html || "";
    if (finalHtml) {
      finalHtml = finalHtml.replace(
        /href="https:\/\/propscholar\.com"/g,
        `href="${trackerBase}?id=${trackingId}&action=click"`,
      );
      finalHtml += `<img src="${trackerBase}?id=${trackingId}&action=open" width="1" height="1" style="display:none;" />`;
    }

    const sendResult = await sendEmail(to, cc, subject, body || "", finalHtml || undefined);
    console.log(`[EMAIL] Sent successfully via ${sendResult.provider}`);

    try {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

    return new Response(JSON.stringify({ success: true, provider: sendResult.provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("EMAIL send error:", message);
    return new Response(JSON.stringify({ error: `Failed to send email: ${message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
