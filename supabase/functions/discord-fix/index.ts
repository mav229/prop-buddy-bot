import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a message polisher for PropScholar Discord moderators.

Your job: Take a casually typed Discord message and rewrite it into THREE variations with different tones:
1. SHORT — concise, minimal, to-the-point version
2. DETAILED — expanded, thorough, professional version with more context
3. EMPATHETIC — warm, understanding, supportive version

Rules:
- Keep proper grammar and punctuation
- Keep Discord formatting (bold, italics, code blocks, emojis) if used
- Don't add unnecessary fluff or corporate speak
- If the message has emojis, keep them natural
- Don't change links, mentions (@), channel references (#), or code
- Match the original language (if Hindi/Hinglish, keep it that way but cleaner)
- For very short inputs (1-4 words), keep the SHORT version very close to the original
- Do NOT expand short greetings or slang into a different phrase (example: "huii" should stay close to "huii", not become "Hi there")
- If the intent is ambiguous, preserve the original wording and only make minimal polish changes

Examples:
- "huii" -> {"options":["huii!","Hey there! How's it going?","Hey! Hope you're doing well 😊"]}
- "that won't work" -> {"options":["That won't work.","That approach won't work — here's why: it doesn't align with the expected setup.","I totally understand your thinking, but unfortunately that approach won't work. Let me help you find a better way!"]}

Return EXACTLY this JSON format, nothing else:
{"options":["short version","detailed version","empathetic version"]}`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again in a moment" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("No response from AI");

    // Parse the JSON response
    let options: string[];
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      options = parsed.options;
      if (!Array.isArray(options) || options.length < 1) throw new Error("Invalid options");
    } catch {
      // Fallback: return the raw text as single option
      options = [raw];
    }

    // Ensure exactly 3 options
    while (options.length < 3) options.push(options[0]);
    options = options.slice(0, 3);

    return new Response(JSON.stringify({ options }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("discord-fix error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
