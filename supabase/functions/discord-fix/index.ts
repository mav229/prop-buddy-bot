import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { text, context } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    let linksContext = "";
    let knowledgeContext = "";
    let tonePresets: { name: string; prompt_instructions: string }[] = [];
    let sb: ReturnType<typeof createClient> | null = null;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (supabaseUrl && supabaseKey) {
        sb = createClient(supabaseUrl, supabaseKey);

        const [linksRes, kbRes, tonesRes] = await Promise.all([
          sb.from("mod_reference_links").select("title, url, keywords").eq("is_active", true),
          sb.from("knowledge_base").select("title, content, category"),
          sb.from("extension_tone_presets").select("name, prompt_instructions").eq("is_active", true).order("sort_order"),
        ]);

        if (linksRes.data && linksRes.data.length > 0) {
          linksContext = `\n\nYou have access to these reference links. If the user's message is related to any of these topics, append the most relevant link at the end of each variation using the format: [Title](URL)\n\nAvailable links:\n${linksRes.data.map((l: any) => `- "${l.title}" (${l.url}) — keywords: ${(l.keywords || []).join(", ")}`).join("\n")}`;
        }

        if (kbRes.data && kbRes.data.length > 0) {
          knowledgeContext = `\n\nYou also have access to PropScholar's knowledge base. Use this context to make responses more accurate and informed. Do NOT dump this info — only use what's relevant to the message being polished.\n\nKnowledge Base:\n${kbRes.data.map((k: any) => `[${k.category}] ${k.title}: ${k.content.substring(0, 300)}`).join("\n\n")}`;
        }

        if (tonesRes.data && tonesRes.data.length > 0) {
          tonePresets = tonesRes.data;
        }
      }
    } catch (e) {
      console.error("Failed to fetch context data:", e);
    }

    // Fallback to defaults if no presets configured
    if (tonePresets.length === 0) {
      tonePresets = [
        { name: "Short", prompt_instructions: "Rewrite concisely — minimal words, direct, professional." },
        { name: "Detailed", prompt_instructions: "Rewrite with more context and detail — thorough, professional." },
        { name: "Empathetic", prompt_instructions: "Rewrite with warmth and empathy — understanding, supportive." },
      ];
    }

    const toneCount = tonePresets.length;
    const toneInstructions = tonePresets
      .map((t, i) => `${i + 1}. ${t.name.toUpperCase()} — ${t.prompt_instructions}`)
      .join("\n");

    // Build conversation context if provided
    let conversationContext = "";
    if (context && Array.isArray(context) && context.length > 0) {
      conversationContext = `\n\nConversation context (previous messages in the channel for reference):\n${context.slice(-3).map((m: string) => `> ${m}`).join("\n")}\n\nThe moderator is responding to the above conversation.`;
    }

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

Your job: Take a casually typed Discord message and rewrite it into ${toneCount} variations with different tones:
${toneInstructions}

Rules:
- Keep proper grammar and punctuation
- Keep Discord formatting (bold, italics, code blocks) if used
- Do NOT use emojis unless the original message has them
- Keep it professional, no fluff or corporate speak
- Don't change links, mentions (@), channel references (#), or code
- Match the original language (if Hindi/Hinglish, keep it that way but cleaner)
- For very short inputs (1-4 words), keep the SHORT version very close to the original
- Do NOT expand short greetings or slang into a different phrase
- If the intent is ambiguous, preserve the original wording and only make minimal polish changes
- If a relevant reference link is available, include it naturally at the end${linksContext}${knowledgeContext}${conversationContext}

Return EXACTLY this JSON format, nothing else:
{"options":[${tonePresets.map(() => '"variation"').join(",")}],"labels":[${tonePresets.map((t) => `"${t.name}"`).join(",")}]}`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);

      // Log failure
      if (sb) {
        sb.from("extension_usage_logs").insert({
          input_length: text.length,
          response_time_ms: Date.now() - startTime,
          success: false,
        }).then(() => {});
      }

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

    let options: string[];
    let labels: string[];
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      options = parsed.options;
      labels = parsed.labels || tonePresets.map((t) => t.name);
      if (!Array.isArray(options) || options.length < 1) throw new Error("Invalid options");
    } catch {
      options = [raw];
      labels = tonePresets.map((t) => t.name);
    }

    while (options.length < toneCount) options.push(options[0]);
    options = options.slice(0, toneCount);
    labels = labels.slice(0, toneCount);

    // Log success
    if (sb) {
      sb.from("extension_usage_logs").insert({
        input_length: text.length,
        response_time_ms: Date.now() - startTime,
        success: true,
      }).then(() => {});
    }

    return new Response(JSON.stringify({ options, labels }), {
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
