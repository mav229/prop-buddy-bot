import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MODERATOR_DELAY_MS = 15000; // 15 seconds
const MONITORED_CHANNEL_ID = "1444871497981235320";

// System prompt for Scholaris AI
const SYSTEM_PROMPT = `You are Scholaris AI, the official PropScholar support bot.

Rules you must follow strictly:

1. Only answer questions related to PropScholar.
   If the question is unrelated, reply:
   "I can only help with PropScholar-related questions."

2. If you do not know the correct answer, do not guess.
   Reply exactly:
   "Let the moderators get online, they could help you in a better way."

3. Never override moderators.
   Never contradict official PropScholar rules.
   Never hallucinate information.

4. Your knowledge must come only from the PropScholar database provided to you.

KNOWLEDGE BASE CONTEXT:
{knowledge_base}

Tone: Professional, clear, trader-friendly.
No emojis. No slang. No unnecessary explanations.`;

// Store pending responses to check for moderator replies
const pendingResponses = new Map<string, { messageId: string; channelId: string; content: string; timestamp: number }>();

async function getAIResponse(message: string, knowledgeContext: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "I'm experiencing technical difficulties. Please try again later.";
  }

  const systemPrompt = SYSTEM_PROMPT.replace("{knowledge_base}", knowledgeContext);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      return "I'm experiencing technical difficulties. Please try again later.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling AI:", error);
    return "I'm experiencing technical difficulties. Please try again later.";
  }
}

async function sendDiscordMessage(channelId: string, content: string, token: string): Promise<void> {
  try {
    // Discord has a 2000 character limit per message
    const chunks = [];
    for (let i = 0; i < content.length; i += 1900) {
      chunks.push(content.slice(i, i + 1900));
    }

    for (const chunk of chunks) {
      const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: chunk }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Discord API error:", response.status, error);
      }
    }
  } catch (error) {
    console.error("Error sending Discord message:", error);
  }
}

async function checkForModeratorReply(channelId: string, afterMessageId: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?after=${afterMessageId}&limit=50`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch messages:", response.status);
      return false;
    }

    const messages = await response.json();
    
    // Check if any message is from a moderator
    for (const msg of messages) {
      if (msg.author?.bot) continue;
      
      // Check if the author has moderator role
      if (msg.member?.roles) {
        // We'll check if the member has any roles (moderators typically have roles)
        // In production, you'd check for specific moderator role IDs
        const hasModerator = msg.member.roles.length > 0;
        if (hasModerator) {
          console.log("Moderator replied, staying silent:", msg.author?.username);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error("Error checking for moderator reply:", error);
    return false;
  }
}

async function getChannelMessagesAfter(channelId: string, messageId: string, token: string): Promise<any[]> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?after=${messageId}&limit=100`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch {
    return [];
  }
}

async function getMemberRoles(guildId: string, userId: string, token: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/guilds/${guildId}/members/${userId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const member = await response.json();
    return member.roles || [];
  } catch {
    return [];
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN");
  if (!DISCORD_BOT_TOKEN) {
    console.error("DISCORD_BOT_TOKEN not configured");
    return new Response(
      JSON.stringify({ error: "Discord bot not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    console.log("Received Discord interaction:", JSON.stringify(body, null, 2));

    // Handle Discord's URL verification
    if (body.type === 1) {
      console.log("Responding to Discord PING");
      return new Response(
        JSON.stringify({ type: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle message create events (from gateway or webhook)
    if (body.type === 2 || body.event === "MESSAGE_CREATE") {
      const message = body.data || body;
      const channelId = message.channel_id;
      const messageId = message.id;
      const content = message.content || message.options?.[0]?.value;
      const authorId = message.author?.id || message.member?.user?.id;
      const guildId = message.guild_id || body.guild_id || "1302986125035573250";

      // Don't respond to bot messages
      if (message.author?.bot) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Initialize Supabase to fetch knowledge base
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch knowledge base
      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      let knowledgeContext = "";
      if (knowledgeEntries && knowledgeEntries.length > 0) {
        knowledgeContext = knowledgeEntries
          .map((entry) => `[${entry.category.toUpperCase()}] ${entry.title}:\n${entry.content}`)
          .join("\n\n---\n\n");
      } else {
        knowledgeContext = "No knowledge base entries available yet.";
      }

      // Get AI response
      const aiResponse = await getAIResponse(content, knowledgeContext);

      // For slash commands, respond immediately (no delay)
      if (body.type === 2) {
        return new Response(
          JSON.stringify({
            type: 4,
            data: {
              content: aiResponse,
            },
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For regular messages: wait 15 seconds, check for moderator replies
      console.log(`Waiting ${MODERATOR_DELAY_MS}ms before responding...`);
      
      // Wait 15 seconds
      await new Promise((resolve) => setTimeout(resolve, MODERATOR_DELAY_MS));

      // Check if a moderator replied during the wait
      const messages = await getChannelMessagesAfter(channelId, messageId, DISCORD_BOT_TOKEN);
      
      let moderatorReplied = false;
      for (const msg of messages) {
        if (msg.author?.bot) continue;
        
        // Get member roles from the guild
        const roles = await getMemberRoles(guildId, msg.author.id, DISCORD_BOT_TOKEN);
        
        // Check if user has any roles (moderators typically have roles)
        // In a real implementation, you'd check for specific moderator role IDs
        if (roles.length > 0) {
          console.log(`Moderator ${msg.author?.username} replied, staying silent.`);
          moderatorReplied = true;
          break;
        }
      }

      // Only respond if no moderator replied
      if (!moderatorReplied) {
        await sendDiscordMessage(channelId, aiResponse, DISCORD_BOT_TOKEN);

        // Store in chat history
        await supabase.from("chat_history").insert([
          { session_id: `discord-${channelId}`, role: "user", content: content },
          { session_id: `discord-${channelId}`, role: "assistant", content: aiResponse },
        ]);
      } else {
        console.log("Moderator handled the question, bot stayed silent.");
      }

      return new Response(
        JSON.stringify({ success: true, moderatorReplied }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle manual trigger to test the bot
    if (body.action === "test") {
      const testMessage = body.message || "What are the drawdown rules?";
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      let knowledgeContext = "";
      if (knowledgeEntries && knowledgeEntries.length > 0) {
        knowledgeContext = knowledgeEntries
          .map((entry) => `[${entry.category.toUpperCase()}] ${entry.title}:\n${entry.content}`)
          .join("\n\n---\n\n");
      }

      const aiResponse = await getAIResponse(testMessage, knowledgeContext);

      return new Response(
        JSON.stringify({ 
          success: true, 
          question: testMessage,
          response: aiResponse 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ message: "Unhandled event type" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
