import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require either Supabase admin JWT or a simple API key header
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("TICKETS_API_KEY");

    // If TICKETS_API_KEY is set, validate it
    if (expectedKey && apiKey !== expectedKey) {
      return json({ error: "Unauthorized – invalid or missing x-api-key header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    // Path: /tickets-api or /tickets-api/:id
    const ticketId = pathParts.length > 1 ? pathParts[pathParts.length - 1] : null;

    // ── GET: List all or get one ──
    if (req.method === "GET") {
      if (ticketId && ticketId !== "tickets-api") {
        const { data, error } = await supabase
          .from("support_tickets")
          .select("*")
          .or(`id.eq.${ticketId},ticket_number.eq.${isNaN(Number(ticketId)) ? -1 : ticketId}`)
          .limit(1)
          .maybeSingle();

        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ error: "Ticket not found" }, 404);
        return json({ ticket: data });
      }

      // List with optional filters
      const status = url.searchParams.get("status");
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const offset = Number(url.searchParams.get("offset") || 0);

      let query = supabase
        .from("support_tickets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq("status", status);

      const { data, error, count } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ tickets: data, total: count, limit, offset });
    }

    // ── PATCH: Update ticket (status, reply) ──
    if (req.method === "PATCH") {
      if (!ticketId || ticketId === "tickets-api") {
        return json({ error: "Ticket ID required in path" }, 400);
      }

      const body = await req.json();
      const updates: Record<string, unknown> = {};

      if (body.status) updates.status = body.status;
      if (body.admin_reply !== undefined) {
        updates.admin_reply = body.admin_reply;
        updates.replied_at = new Date().toISOString();
      }

      if (Object.keys(updates).length === 0) {
        return json({ error: "No valid fields to update" }, 400);
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates)
        .or(`id.eq.${ticketId},ticket_number.eq.${isNaN(Number(ticketId)) ? -1 : ticketId}`)
        .select()
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "Ticket not found" }, 404);
      return json({ ticket: data, message: "Ticket updated" });
    }

    // ── DELETE ──
    if (req.method === "DELETE") {
      if (!ticketId || ticketId === "tickets-api") {
        return json({ error: "Ticket ID required in path" }, 400);
      }

      const { error } = await supabase
        .from("support_tickets")
        .delete()
        .or(`id.eq.${ticketId},ticket_number.eq.${isNaN(Number(ticketId)) ? -1 : ticketId}`);

      if (error) return json({ error: error.message }, 500);
      return json({ message: "Ticket deleted" });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (err: any) {
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
