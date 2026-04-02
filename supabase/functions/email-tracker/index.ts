import { createClient } from "npm:@supabase/supabase-js@2.49.4";

// 1x1 transparent PNG pixel
const PIXEL = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), c => c.charCodeAt(0));

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");
  const action = url.searchParams.get("action"); // "open" or "click"

  if (!trackingId) {
    return new Response("Missing tracking id", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    if (action === "click") {
      await sb.from("email_logs").update({ clicked_at: new Date().toISOString() }).eq("tracking_id", trackingId);
      // Redirect to propscholar.com
      return new Response(null, {
        status: 302,
        headers: { Location: "https://propscholar.com" },
      });
    }

    // Default: open tracking pixel
    await sb.from("email_logs").update({ opened_at: new Date().toISOString() }).eq("tracking_id", trackingId);
    return new Response(PIXEL, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    });
  } catch (err) {
    console.error("Tracker error:", err);
    // Still return pixel/redirect so user experience isn't broken
    if (action === "click") {
      return new Response(null, { status: 302, headers: { Location: "https://propscholar.com" } });
    }
    return new Response(PIXEL, { headers: { "Content-Type": "image/png" } });
  }
});
