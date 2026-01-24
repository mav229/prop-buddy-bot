import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketRequest {
  email: string;
  phone: string;
  problem: string;
  session_id?: string;
  chat_history?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: TicketRequest = await req.json();
    const { email, phone, problem, session_id, chat_history } = body;

    // Validate required fields (phone is optional)
    if (!email || !problem) {
      return new Response(
        JSON.stringify({ error: "Email and problem description are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the external backend URL from environment
    const ticketBackendUrl = Deno.env.get("TICKET_BACKEND_URL");
    
    // Initialize Supabase client for storing ticket locally
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate a ticket ID
    const ticketId = crypto.randomUUID();

    // Store ticket in local database for tracking
    const { error: dbError } = await supabase.from("support_tickets").insert({
      id: ticketId,
      email,
      phone: phone || "",
      problem,
      session_id: session_id || null,
      chat_history: chat_history || null,
      status: "open",
      source: "widget",
    });

    if (dbError) {
      console.error("Error storing ticket:", dbError);
      // Continue even if local storage fails - still forward to external backend
    }

    // Forward to external backend if configured
    let externalTicketId: string | null = null;
    if (ticketBackendUrl) {
      try {
        const safeSessionId = typeof session_id === "string" ? session_id : "";
        const safeChatHistory = typeof chat_history === "string" ? chat_history : "";
        const safePhone = typeof phone === "string" ? phone : "";

        const externalResponse = await fetch(ticketBackendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ticket_id: ticketId,
            ticketId,
            email: email || "",
            phone: safePhone,
            problem: problem || "",
            session_id: safeSessionId,
            sessionId: safeSessionId,
            chat_history: safeChatHistory,
            chatHistory: safeChatHistory,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }),
        });

        if (!externalResponse.ok) {
          const errorText = await externalResponse.text();
          console.error("External backend returned error:", errorText);
          // Don't fail the request - ticket is still stored locally
        } else {
          const externalData = await externalResponse.json();
          console.log("Ticket forwarded to external backend successfully:", externalData);
          // Try to extract ticket ID from external response
          externalTicketId = externalData?.ticket_id || externalData?.ticketId || externalData?.id || null;
        }
      } catch (externalError) {
        console.error("Failed to forward to external backend:", externalError);
        // Don't fail - ticket is stored locally
      }
    } else {
      console.log("No TICKET_BACKEND_URL configured - ticket stored locally only");
    }

    // Use external ticket ID if available, otherwise fall back to local UUID
    const finalTicketId = externalTicketId || ticketId;

    // Also store as a lead for tracking
    try {
      await supabase.from("widget_leads").insert({
        email,
        session_id: session_id || null,
        source: "ticket",
        page_url: null,
      });
    } catch (leadError) {
      console.error("Lead insert error:", leadError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket_id: finalTicketId,
        message: "Ticket created successfully" 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error in create-ticket function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
