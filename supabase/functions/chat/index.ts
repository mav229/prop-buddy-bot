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
EMAIL GATING FOR DISCOUNTS (CRITICAL - FOLLOW THIS EXACTLY):
═══════════════════════════════════════════════════════════════

When a user asks for a discount, coupon, promo code, deal, savings, or any special offer:

1. FIRST check if ANY previous message in this conversation contains an email address (like name@example.com)
2. If NO email has been provided yet in this conversation, you MUST ask for it first:
   "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over 🎁"
3. DO NOT share any coupon codes until the user provides a valid email address
4. ONLY AFTER they provide a valid email (like name@example.com), share the coupon code with full details
5. If they already provided an email earlier in the conversation, you can share the coupon immediately

NEVER share coupon codes without collecting an email first - this is mandatory!

Example flow:
User: "Do you have any discount codes?"
You: "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over 🎁"
User: "john@gmail.com"
You: "Thanks! Here's your exclusive code: **PS2026** - 20% off all challenges..."

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

ACTIVE COUPONS & DISCOUNTS:
{coupons_context}

When users ask about discounts, deals, coupon codes, or savings - REMEMBER to ask for email first if not already provided!
Present them nicely with the code, discount, and benefits. If no coupons are active, let them know to check back soon.

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

    // Fetch active coupons
    const { data: coupons, error: couponsError } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, description, benefits, min_purchase, valid_until")
      .eq("is_active", true)
      .or("valid_until.is.null,valid_until.gt." + new Date().toISOString());

    if (couponsError) {
      console.error("Error fetching coupons:", couponsError);
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

    // Format coupons for context
    let couponsContext = "";
    if (coupons && coupons.length > 0) {
      couponsContext = coupons
        .map((c) => {
          const discount = c.discount_type === "percentage" 
            ? `${c.discount_value}% off` 
            : `$${c.discount_value} off`;
          let info = `• Code: ${c.code} - ${discount}`;
          if (c.description) info += `\n  Description: ${c.description}`;
          if (c.benefits) info += `\n  Benefits: ${c.benefits}`;
          if (c.min_purchase && c.min_purchase > 0) info += `\n  Min purchase: $${c.min_purchase}`;
          if (c.valid_until) info += `\n  Expires: ${new Date(c.valid_until).toLocaleDateString()}`;
          return info;
        })
        .join("\n\n");
    } else {
      couponsContext = "No active coupons at the moment.";
    }

    const systemPromptWithKnowledge = SYSTEM_PROMPT
      .replace("{knowledge_base}", knowledgeContext)
      .replace("{coupons_context}", couponsContext);

    // Note: Chat history storage is handled by the frontend useChat hook
    // to avoid duplicate entries

    console.log("Sending request to Lovable AI Gateway...");

    // Calculate input tokens (rough estimate: ~4 chars per token)
    const inputText = systemPromptWithKnowledge + messages.map((m: any) => m.content).join(" ");
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

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

    // Create a transform stream to inject token usage at the end
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let outputTokens = 0;
    
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          // Send usage data as final SSE event
          const usageData = {
            inputTokens: estimatedInputTokens,
            outputTokens: outputTokens,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: usageData })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        
        // Count output tokens from the stream
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                outputTokens += Math.ceil(content.length / 4);
              }
            } catch {}
          }
        }
        
        // Filter out [DONE] from original stream - we'll send our own
        const filteredText = text.replace(/data: \[DONE\]\n\n/g, "");
        if (filteredText) {
          controller.enqueue(encoder.encode(filteredText));
        }
      },
    });

    return new Response(stream, {
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
