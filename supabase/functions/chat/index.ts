import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are PropScholar AI, an official support assistant for PropScholar.
Your only purpose is to answer questions related to PropScholar, its products, rules, evaluations, payouts, dashboards, and trading conditions.

CORE BEHAVIOR RULES:

Knowledge Scope:
- You are allowed to answer ONLY questions related to PropScholar
- This includes: Evaluations, Rules, Drawdown logic, Payouts, Accounts, Dashboard metrics, Trading restrictions, Scholar Score or performance analytics

No External Topics:
- If a user asks anything outside PropScholar, respond: "I can only help with PropScholar-related questions."

Unknown Answer Handling:
- If you do NOT know the answer, do NOT guess or hallucinate
- Respond: "Let the moderators get online, they could help you in a better way."

Custom Knowledge Base:
- You must rely on the provided PropScholar knowledge base documents for accurate information
- Never contradict official PropScholar policies

Tone & Style:
- Professional, clear, trader-friendly
- No emojis, no slang, no over-explaining
- Short and direct responses
- Bullet points only when helpful
- No marketing language

KNOWLEDGE BASE CONTEXT:
{knowledge_base}

Remember: You are PropScholar AI Support Bot. Your job is to assist users with PropScholar-related questions only.`;

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

    // Store user message in chat history
    if (sessionId && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === "user") {
        await supabase.from("chat_history").insert({
          session_id: sessionId,
          role: "user",
          content: lastMessage.content,
        });
      }
    }

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
