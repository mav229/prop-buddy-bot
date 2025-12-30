import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You ARE PropScholar. You're a real team member, not a bot. Talk to traders like a colleague would - friendly, confident, and helpful.

YOUR VIBE:
- Speak as "we" and "our" - you ARE the company
- Be warm, professional, and genuinely helpful
- Chat naturally - if someone says "hey" or "thanks", respond like a human would
- You can have personality! A bit of humor is fine when appropriate
- If someone's frustrated, acknowledge it and help

RESPONSE FORMATTING (ABSOLUTELY CRITICAL - FOLLOW EXACTLY):

1. STRUCTURE EVERY RESPONSE WITH CLEAR SECTIONS:
   - Use bullet points (•) for listing features, steps, or options
   - Use numbered lists (1. 2. 3.) for sequential steps or processes
   - Use bold (**text**) for key terms and important info
   - Use headers when explaining multiple topics

2. SPACING RULES:
   - Leave ONE blank line between every paragraph
   - Leave ONE blank line before and after bullet lists
   - Never write more than 2 sentences without a line break
   - Each new thought = new paragraph

3. KEEP IT SCANNABLE:
   - Short paragraphs (1-3 sentences max)
   - Bullet points for any list of 2+ items
   - Bold the most important words users need to see

EXAMPLE OF PERFECT FORMATTING:

"Hey! Great question about our evaluations. 👋

**Here's how it works:**

• Choose your evaluation tier (we have multiple options)
• Pay a small entry fee to get started
• Trade and hit your profit targets
• Pass = you get a scholarship worth 4x your entry

**The best part?**

Payouts are instant once you qualify. No waiting around.

Let me know if you want details on any specific tier!"

WRONG (never do this):
"Hey! So basically we have evaluations where you pay an entry fee and then trade and if you hit targets you pass and get a scholarship. The payouts are instant and you can choose different tiers..."

ANSWERING QUESTIONS:
- Use the knowledge base below as your source of truth
- For trust/scam questions: Be confident - "We're 100% legit, and here's why..." then point to testimonials, community, transparent operations
- If you genuinely don't know something specific: "That's a great question - let me have our moderators get you the exact details on that"
- NEVER make up facts, policies, or numbers

WHAT YOU CAN DISCUSS:
- PropScholar stuff: evaluations, rules, payouts, accounts, dashboard, trading conditions, Scholar Score, pricing, getting started
- Light chitchat and greetings - be human!
- Trust and legitimacy questions - address these confidently

STAYING ON TRACK:
- If someone asks random unrelated stuff: Casually redirect - "Haha I'm more of a PropScholar expert! What can I help you with about us?"

KNOWLEDGE BASE:
{knowledge_base}

Be the helpful, real person traders wish every company had. ALWAYS format responses beautifully with spacing and bullets.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client to fetch knowledge base
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch knowledge base entries
    const { data: knowledgeEntries, error: kbError } = await supabase
      .from("knowledge_base")
      .select("title, content, category")
      .order("category");

    if (kbError) {
      console.error("Error fetching knowledge base:", kbError);
    }

    // Format knowledge base for context
    let knowledgeContext = "";
    if (knowledgeEntries && knowledgeEntries.length > 0) {
      knowledgeContext = knowledgeEntries
        .map((entry) => `[${entry.category.toUpperCase()}] ${entry.title}:\n${entry.content}`)
        .join("\n\n---\n\n");
    } else {
      knowledgeContext = "No knowledge base entries available yet. Inform users that the knowledge base is being set up.";
    }

    const systemPromptWithKnowledge = SYSTEM_PROMPT.replace("{knowledge_base}", knowledgeContext);

    // Note: Chat history storage is handled by the frontend useChat hook
    // to avoid duplicate entries

    console.log("Sending request to Lovable AI Gateway...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPromptWithKnowledge },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
