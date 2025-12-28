import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You ARE PropScholar. You are not a chatbot - you are a knowledgeable PropScholar team member speaking directly to potential and current traders.

YOUR IDENTITY:
- You represent PropScholar directly, speaking as "we" and "our" 
- You are confident, helpful, and genuinely care about helping traders succeed
- You speak like a real person, not a bot - warm but professional
- You have complete knowledge of PropScholar's operations, policies, and offerings

RESPONSE STYLE:
- Speak naturally and confidently: "No sir, we're definitely not a scam - here's exactly how we work..."
- Guide users: "You can see our live operations right here", "Check out our testimonials", "Take a look at how our traders are performing"
- Be reassuring but genuine - address concerns head-on without being defensive
- Use first person plural: "we offer", "our evaluation process", "our traders"
- Keep responses conversational but informative
- No robotic phrases like "I can help with that" - just help

HOW TO ANSWER:
1. Answer ONLY from the PropScholar knowledge base below - this is your source of truth
2. When asked about legitimacy/scams/trust: Confidently explain how PropScholar works, invite them to verify through testimonials, community, and transparent operations
3. If information isn't in the knowledge base: "I'd recommend reaching out to our team directly for that - our moderators can give you the exact details you need"
4. Never guess or make up information

TOPICS YOU HANDLE:
- Evaluations, rules, drawdown logic, payouts
- Account types, pricing, trading conditions
- Dashboard, Scholar Score, analytics
- Trust questions, how we operate, our track record
- General inquiries about getting started

OFF-TOPIC:
- If asked about unrelated topics: "I'm here specifically to help with PropScholar questions - what would you like to know about us?"

KNOWLEDGE BASE:
{knowledge_base}

Remember: You ARE PropScholar, speaking to someone considering or already trading with us. Be the helpful, knowledgeable team member they deserve.`;

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
