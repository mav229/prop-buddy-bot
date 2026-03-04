import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const DEFAULT_AGENT_NAME = "Harris - PropScholar";
const DEFAULT_AGENT_AVATAR_URL = "https://res.cloudinary.com/dzozyqlqr/image/upload/v1766327970/Gemini_Generated_Image_hvp9g0hvp9g0hvp9_1_q6pmq8.png";

const sanitizeAgentMeta = (value: unknown, fallback: string, maxLength: number) => {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[\r\n\[\]]/g, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, maxLength) : fallback;
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth: require either x-api-key OR authenticated admin user
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("TICKETS_API_KEY");
    let authorized = false;

    if (expectedKey && apiKey === expectedKey) {
      authorized = true;
    }

    if (!authorized) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7).trim()
          : authHeader.trim();

        if (token) {
          const { data: { user }, error: userError } = await supabase.auth.getUser(token);
          if (!userError && user) {
            const { data: roleRow } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", user.id)
              .eq("role", "admin")
              .maybeSingle();
            if (roleRow) authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return json({ error: "Unauthorized" }, 401);
    }

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
      const adminReply = typeof body.admin_reply === "string" ? body.admin_reply.trim() : "";
      const agentName = sanitizeAgentMeta(body.agent_name, DEFAULT_AGENT_NAME, 80);
      const agentAvatarUrl = sanitizeAgentMeta(body.agent_avatar_url, DEFAULT_AGENT_AVATAR_URL, 400);

      if (body.status) updates.status = body.status;
      if (body.admin_reply !== undefined) {
        updates.admin_reply = adminReply;
        updates.replied_at = new Date().toISOString();
        // Auto-escalate status to in_progress when admin first replies to an open ticket
        if (!body.status) {
          // We'll check current status after fetching the ticket below
        }
      }

      if (Object.keys(updates).length === 0) {
        return json({ error: "No valid fields to update" }, 400);
      }

      // Find the ticket first to get session_id
      const { data: ticketRow } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`id.eq.${ticketId},ticket_number.eq.${isNaN(Number(ticketId)) ? -1 : ticketId}`)
        .limit(1)
        .maybeSingle();

      if (!ticketRow) return json({ error: "Ticket not found" }, 404);

      // Auto-set to in_progress when admin replies to an open ticket
      if (adminReply && ticketRow.status === "open" && !updates.status) {
        updates.status = "in_progress";
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .update(updates)
        .eq("id", ticketRow.id)
        .select()
        .maybeSingle();

      if (error) return json({ error: error.message }, 500);

      // If admin_reply is set and ticket has a session_id, insert reply into chat_history
      // so the user sees it in their chat in realtime
      if (adminReply && ticketRow.session_id) {
        const { error: chatError } = await supabase.from("chat_history").insert({
          session_id: ticketRow.session_id,
          role: "assistant",
          content: `[[AGENT_NAME:${agentName}]]\n[[AGENT_AVATAR:${agentAvatarUrl}]]\n${adminReply}`,
          source: "agent",
        });
        if (chatError) {
          console.error("Failed to insert agent reply into chat:", chatError);
        } else {
          console.log(`Agent reply inserted into chat for session ${ticketRow.session_id}`);
        }
      }

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
