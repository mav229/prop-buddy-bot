import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_ids, session_id } = await req.json();

    // Validate input - must provide session_id or session_ids
    const ids: string[] = session_ids || (session_id ? [session_id] : []);
    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "session_id or session_ids required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cap to prevent abuse
    if (ids.length > 100) {
      return new Response(
        JSON.stringify({ error: "Too many session IDs (max 100)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate session ID format (basic alphanumeric + hyphens)
    for (const id of ids) {
      if (typeof id !== "string" || id.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(id)) {
        return new Response(
          JSON.stringify({ error: "Invalid session_id format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("chat_history")
      .select("id, session_id, role, content, created_at, source");

    if (ids.length === 1) {
      query = query.eq("session_id", ids[0]);
    } else {
      query = query.in("session_id", ids);
    }

    const { data, error } = await query.order("created_at", { ascending: true });

    if (error) {
      console.error("DB error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch chat history" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
