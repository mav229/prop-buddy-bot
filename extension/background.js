const API_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/functions/v1/discord-fix";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ps-fix-generate") {
    (async () => {
      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({ text: message.text || "", context: message.context }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          sendResponse({ ok: false, error: data.error || `Error ${response.status}` });
          return;
        }

        sendResponse({ ok: true, data });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" });
      }
    })();

    return true;
  }

  if (message?.type === "ps-fix-log-tone") {
    // Fire-and-forget tone logging — no response needed
    return false;
  }
});
