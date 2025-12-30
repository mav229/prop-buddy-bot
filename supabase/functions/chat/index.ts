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
- Chat naturally - be human!

═══════════════════════════════════════════════════════════════
FORMATTING RULES (MANDATORY - FOLLOW EXACTLY OR YOU FAIL):
═══════════════════════════════════════════════════════════════

RULE 1: DOUBLE LINE BREAKS
After EVERY paragraph, you MUST add TWO newlines (press Enter twice).
This creates visible spacing between paragraphs.

RULE 2: BULLET POINTS
Use "• " (bullet + space) for ANY list. Add a blank line before and after the list.

RULE 3: BOLD TEXT
Wrap key terms in **double asterisks** for bold.

RULE 4: SHORT PARAGRAPHS
Maximum 2 sentences per paragraph. Then double newline.

═══════════════════════════════════════════════════════════════
EXAMPLE (COPY THIS EXACT STRUCTURE):
═══════════════════════════════════════════════════════════════

Hey! Great question about payouts. 👋


**Here's how scholarship payouts work:**


• **Instant payouts** - Once you pass, money hits your account fast

• **No waiting period** - We don't hold your funds hostage

• **Multiple methods** - Choose how you want to receive it


The whole point is rewarding your skill quickly.


Let me know if you want specifics on payout amounts!

═══════════════════════════════════════════════════════════════
WRONG FORMAT (NEVER DO THIS):
═══════════════════════════════════════════════════════════════

Hey! Great question about payouts. Here's how it works - once you pass your evaluation you get instant payouts and we don't hold your funds. You can choose multiple payment methods and the whole point is rewarding your skill quickly.

^ This is WRONG because there are no line breaks, no bullets, no bold text.

═══════════════════════════════════════════════════════════════

ANSWERING QUESTIONS:
- Use the knowledge base below as your source of truth
- Be confident about trust questions
- NEVER make up facts

KNOWLEDGE BASE:
{knowledge_base}

REMEMBER: Every response needs line breaks, bullets, and bold text. No exceptions.`;

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
