import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, email } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Grab chat history from DB for this session
    const { data: chatRows } = await supabase
      .from("chat_history")
      .select("role, content, created_at")
      .eq("session_id", session_id)
      .order("created_at", { ascending: true })
      .limit(100);

    const chatHistory = chatRows || [];

    // Try to find email from session_cache or widget_leads if not provided
    let resolvedEmail = email || "";
    if (!resolvedEmail) {
      const { data: cacheRow } = await supabase
        .from("session_cache")
        .select("email")
        .eq("session_id", session_id)
        .limit(1)
        .maybeSingle();
      if (cacheRow?.email) resolvedEmail = cacheRow.email;
    }
    if (!resolvedEmail) {
      const { data: leadRow } = await supabase
        .from("widget_leads")
        .select("email")
        .eq("session_id", session_id)
        .limit(1)
        .maybeSingle();
      if (leadRow?.email) resolvedEmail = leadRow.email;
    }

    // Create support ticket as an escalation
    const { data, error: dbError } = await supabase
      .from("support_tickets")
      .insert({
        email: resolvedEmail || "no-email@escalation",
        phone: "",
        problem: "User requested live agent support",
        session_id,
        chat_history: JSON.stringify(chatHistory),
        status: "open",
        source: "escalation",
      })
      .select("id, ticket_number")
      .single();

    if (dbError) {
      console.error("Error creating escalation:", dbError);
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Also forward to external backend if configured
    const ticketBackendUrl = Deno.env.get("TICKET_BACKEND_URL");
    if (ticketBackendUrl) {
      try {
        await fetch(ticketBackendUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: resolvedEmail || "no-email@escalation",
            problem: "User requested live agent support",
            session_id,
            chat_history: chatHistory,
          }),
        });
      } catch (e) {
        console.error("Failed to notify external backend:", e);
      }
    }

    console.log(`Escalation created: ticket #${data.ticket_number}, session ${session_id}`);

    return new Response(
      JSON.stringify({ success: true, ticket_number: data.ticket_number, ticket_id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("Escalate error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
