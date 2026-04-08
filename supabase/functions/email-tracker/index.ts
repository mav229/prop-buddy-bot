import { createClient } from "npm:@supabase/supabase-js@2.49.4";

// 1x1 transparent PNG pixel
const PIXEL = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="), c => c.charCodeAt(0));

const DEST_MAP: Record<string, string> = {
  trustpilot: "https://www.trustpilot.com/review/propscholar.com",
  google: "https://g.page/r/CdHO0VDiVc1aEAI/review",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get("id");
  const action = url.searchParams.get("action"); // "open" or "click"
  const dest = url.searchParams.get("dest"); // "trustpilot" or "google"

  if (!trackingId) {
    return new Response("Missing tracking id", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    if (action === "click") {
      await sb.from("email_logs").update({ clicked_at: new Date().toISOString() }).eq("tracking_id", trackingId);
      const redirectUrl = (dest && DEST_MAP[dest]) || "https://propscholar.com";
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
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
    if (action === "click") {
      const redirectUrl = (dest && DEST_MAP[dest]) || "https://propscholar.com";
      return new Response(null, { status: 302, headers: { Location: redirectUrl } });
    }
    return new Response(PIXEL, { headers: { "Content-Type": "image/png" } });
  }
});
