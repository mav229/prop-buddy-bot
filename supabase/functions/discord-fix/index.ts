import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache for context data (links, KB, tones) — refreshes every 10 min
let contextCache: { links: any[]; kb: any[]; tones: any[]; cachedAt: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getContextData(sb: ReturnType<typeof createClient>) {
  if (contextCache && Date.now() - contextCache.cachedAt < CACHE_TTL) {
    return contextCache;
  }

  const [linksRes, kbRes, tonesRes] = await Promise.all([
    sb.from("mod_reference_links").select("title, url, keywords").eq("is_active", true),
    sb.from("knowledge_base").select("title, content, category"),
    sb.from("extension_tone_presets").select("name, prompt_instructions").eq("is_active", true).order("sort_order"),
  ]);

  contextCache = {
    links: linksRes.data || [],
    kb: kbRes.data || [],
    tones: tonesRes.data || [],
    cachedAt: Date.now(),
  };
  return contextCache;
}

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

    let sb: ReturnType<typeof createClient> | null = null;
    let linksContext = "";
    let knowledgeContext = "";
    let tonePresets: { name: string; prompt_instructions: string }[] = [];

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (supabaseUrl && supabaseKey) {
        sb = createClient(supabaseUrl, supabaseKey);
        const ctx = await getContextData(sb);

        if (ctx.links.length > 0) {
          // Only include top 10 most relevant links (keep prompt lean)
          linksContext = `\n\nReference links (append relevant ones at end):\n${ctx.links.slice(0, 10).map((l: any) => `- ${l.title}: ${l.url} [${(l.keywords || []).join(",")}]`).join("\n")}`;
        }

        if (ctx.kb.length > 0) {
          // Trim KB entries to 150 chars each to save tokens
          knowledgeContext = `\n\nKB context (use only what's relevant):\n${ctx.kb.map((k: any) => `[${k.category}] ${k.title}: ${k.content.substring(0, 150)}`).join("\n")}`;
        }

        if (ctx.tones.length > 0) {
          tonePresets = ctx.tones;
        }
      }
    } catch (e) {
      console.error("Failed to fetch context data:", e);
    }

    // Fallback defaults — only 2 tones (no Short)
    if (tonePresets.length === 0) {
      tonePresets = [
        { name: "Short", prompt_instructions: "Rewrite as short and direct — minimal words, clear point, no fluff." },
        { name: "Balanced", prompt_instructions: "Rewrite with clarity and professionalism — clean, well-structured, moderate length." },
        { name: "Detailed", prompt_instructions: "Rewrite with more context and detail — thorough, professional, comprehensive." },
      ];
    }

    const toneCount = tonePresets.length;
    const toneInstructions = tonePresets
      .map((t, i) => `${i + 1}. ${t.name.toUpperCase()} — ${t.prompt_instructions}`)
      .join("\n");

    // Build conversation context if provided
    let conversationContext = "";
    if (context && Array.isArray(context) && context.length > 0) {
      conversationContext = `\n\nRecent conversation:\n${context.slice(-3).map((m: string) => `> ${m}`).join("\n")}`;
    }

    // Compact system prompt to reduce token usage
    const systemPrompt = `You polish Discord messages for PropScholar moderators. Rewrite into ${toneCount} variations:
${toneInstructions}

Rules: Keep grammar/punctuation. Keep Discord formatting. No emojis unless original has them. Professional, no fluff. Don't change links/@mentions/#channels/code. Match original language. For very short inputs keep close to original. If ambiguous, preserve original wording.${linksContext}${knowledgeContext}${conversationContext}

Return JSON only: {"options":[${tonePresets.map(() => '"string text here"').join(",")}],"labels":[${tonePresets.map((t) => `"${t.name}"`).join(",")}]}
Each option MUST be a plain string, NOT an object.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);

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

    // Log success (non-blocking)
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
