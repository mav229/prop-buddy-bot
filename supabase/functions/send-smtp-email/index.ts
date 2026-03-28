import { SMTPClient } from "npm:emailjs@4.0.3";

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
    const { to, subject, body, html } = await req.json();

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
      subject,
      text: body || "",
      attachment: html
        ? [{ data: html, alternative: true }]
        : undefined,
    });

    console.log("Email sent:", message);

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
