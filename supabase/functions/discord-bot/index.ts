import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature-ed25519, x-signature-timestamp",
};

// Verify Discord request signature
async function verifyDiscordSignature(
  request: Request,
  rawBody: string
): Promise<boolean> {
  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY");
  if (!publicKey) {
    console.error("DISCORD_PUBLIC_KEY not configured");
    return false;
  }

  const signature = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    console.log("Missing signature headers");
    return false;
  }

  try {
    const message = new TextEncoder().encode(timestamp + rawBody);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);

    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  } catch (e) {
    console.error("Signature verification error:", e);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MODERATOR_DELAY_MS = 15000;
const MONITORED_CHANNEL_ID = "1444871497981235320";
const GUILD_ID = "1302986125035573250";
const BOT_USER_ID = "1454702186398482555";

// Moderator role IDs - add your actual moderator role IDs here
const MODERATOR_ROLE_IDS: string[] = [];

// Track recent messages per channel for conversation detection
const recentMessages = new Map<string, { authorId: string; timestamp: number }[]>();

const SYSTEM_PROMPT = `You ARE Scholaris AI - PropScholar's official support and your traders' go-to buddy. You're smart, friendly, and genuinely love helping people crush it in trading.

YOUR PERSONALITY:
- Friendly and warm - like a helpful friend who's also a trading expert 🔥
- Confident but never arrogant
- Use emojis naturally to add personality (but don't overdo it - 1-3 per message max)
- Remember users and make them feel valued
- Make conversations enjoyable, not just transactional

EMOJI STYLE (use these naturally):
- 🚀 for exciting stuff, growth, success
- ✅ for confirmations, completed info
- 💪 for encouragement
- 📊 for trading/stats related
- 🎯 for goals, targets, accuracy
- 💡 for tips and insights
- 🔥 for hype moments
- ⚡ for quick info

HOW TO TALK:
- "Hey! Great question 🎯 Here's the deal..." ✓
- "Absolutely! Let me break that down for you 💡" ✓
- "Welcome back! 🔥 So about your question..." ✓ (when you recognize them)
- "No worries at all, here's what you need to know ✅" ✓
- "I can assist you with that query." ✗ (too robotic - never talk like this)

WHAT YOU DO:
- Answer PropScholar questions from the knowledge base
- Remember past conversations - reference them naturally ("Like we discussed before...")
- Build rapport - people should enjoy talking to you
- If you don't know something: "Hmm, that's a great question! 🤔 Let me have the mods get you the exact details on that"
- Off-topic stuff: Be cool about it - "Haha I wish I could help with that! 😄 But I'm your PropScholar guy - what can I help you with about trading?"

RULES:
- Never make up facts, policies, or numbers
- Never contradict moderators or official PropScholar rules
- Only use information from the knowledge base
- Keep it professional even when being friendly - you represent PropScholar

KNOWLEDGE BASE:
{knowledge_base}

Make every trader feel like they've got a friend on the inside who actually cares about their success 🚀`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

async function getUserConversationHistory(
  supabase: any,
  discordUserId: string,
  limit = 20
): Promise<ConversationMessage[]> {
  if (!discordUserId) {
    console.error("No discordUserId provided for conversation history");
    return [];
  }
  
  const sessionId = `discord-user-${discordUserId}`;
  console.log(`Fetching conversation history for session: ${sessionId}`);
  
  try {
    const { data, error } = await supabase
      .from("chat_history")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching user history:", error);
      return [];
    }

    const history = (data || []).reverse().map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
    
    console.log(`Found ${history.length} messages in history for user ${discordUserId}`);
    
    return history;
  } catch (e) {
    console.error("Error in getUserConversationHistory:", e);
    return [];
  }
}

async function storeUserMessage(
  supabase: any,
  discordUserId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  try {
    const { error } = await supabase.from("chat_history").insert({
      session_id: `discord-user-${discordUserId}`,
      role,
      content,
    });
    
    if (error) {
      console.error("Error storing user message:", error);
    } else {
      console.log(`Stored ${role} message for user ${discordUserId}`);
    }
  } catch (e) {
    console.error("Error storing message:", e);
  }
}

interface ReplyContext {
  content: string;
  authorName: string;
}

async function getAIResponse(
  message: string,
  knowledgeContext: string,
  conversationHistory: ConversationMessage[] = [],
  userName?: string,
  repliedTo?: ReplyContext
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "I'm experiencing technical difficulties. Please try again later.";
  }

  let systemPrompt = SYSTEM_PROMPT.replace("{knowledge_base}", knowledgeContext);
  
  // Add user context if we have history
  if (conversationHistory.length > 0 && userName) {
    systemPrompt += `\n\nYou are continuing a conversation with ${userName}. Here is your previous conversation with them - use this context to provide personalized responses and remember what they've asked before.`;
  }

  // Build messages array with history
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // Build current message with reply context if present
  let currentMessage = message;
  if (repliedTo && repliedTo.content) {
    currentMessage = `[User is replying to a message from ${repliedTo.authorName}: "${repliedTo.content}"]\n\nUser's message: ${message}`;
    console.log(`Including reply context in AI message: "${repliedTo.content}"`);
  }

  // Add current message
  messages.push({ role: "user", content: currentMessage });

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
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

async function sendDiscordMessage(channelId: string, content: string, token: string, replyToMessageId?: string): Promise<void> {
  try {
    const chunks = [];
    for (let i = 0; i < content.length; i += 1900) {
      chunks.push(content.slice(i, i + 1900));
    }

    for (let i = 0; i < chunks.length; i++) {
      const body: any = { content: chunks[i] };
      
      // Only add message reference to first chunk
      if (i === 0 && replyToMessageId) {
        body.message_reference = { message_id: replyToMessageId };
      }

      const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
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

    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function getRecentChannelMessages(channelId: string, token: string, limit = 10): Promise<any[]> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

// Fetch a specific message by ID (for replied-to messages)
async function getMessageById(channelId: string, messageId: string, token: string): Promise<any | null> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch message ${messageId}:`, response.status);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error("Error fetching message by ID:", e);
    return null;
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

    if (!response.ok) return [];
    const member = await response.json();
    return member.roles || [];
  } catch {
    return [];
  }
}

async function registerGuildSlashCommands(token: string): Promise<void> {
  // Register a single /ask command in the configured guild.
  // Note: Application ID is the same as the bot user ID.
  const applicationId = BOT_USER_ID;

  const commands = [
    {
      name: "ask",
      description: "Ask PropScholar a question",
      options: [
        {
          type: 3, // STRING
          name: "question",
          description: "Your PropScholar question",
          required: true,
        },
      ],
    },
  ];

  const resp = await fetch(
    `${DISCORD_API_BASE}/applications/${applicationId}/guilds/${GUILD_ID}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    }
  );

  if (!resp.ok) {
    const t = await resp.text();
    console.error("Failed to register slash commands:", resp.status, t);
    throw new Error("Failed to register slash commands");
  }
}

function isModeratorRole(roles: string[]): boolean {
  // If specific moderator roles are defined, check against them
  if (MODERATOR_ROLE_IDS.length > 0) {
    return roles.some(role => MODERATOR_ROLE_IDS.includes(role));
  }
  // Otherwise, anyone with roles is considered a moderator
  return roles.length > 0;
}

function isBotMentioned(content: string, mentions: any[]): boolean {
  // Check if bot is mentioned by ID
  if (content.includes(`<@${BOT_USER_ID}>`) || content.includes(`<@!${BOT_USER_ID}>`)) {
    return true;
  }
  // Check mentions array
  if (mentions && mentions.some(m => m.id === BOT_USER_ID)) {
    return true;
  }
  return false;
}

function isConversation(channelId: string, currentAuthorId: string, messageTimestamp: number): boolean {
  const channelHistory = recentMessages.get(channelId) || [];
  const recentWindow = 30000; // 30 seconds window
  
  // Get messages in the last 30 seconds
  const recentMsgs = channelHistory.filter(
    m => messageTimestamp - m.timestamp < recentWindow && m.authorId !== currentAuthorId
  );
  
  // If there are recent messages from different users, it's a conversation
  if (recentMsgs.length >= 1) {
    const uniqueAuthors = new Set(recentMsgs.map(m => m.authorId));
    // If there's back-and-forth between users, it's a conversation
    if (uniqueAuthors.size >= 1) {
      return true;
    }
  }
  
  return false;
}

function updateMessageHistory(channelId: string, authorId: string, timestamp: number): void {
  const history = recentMessages.get(channelId) || [];
  history.push({ authorId, timestamp });
  
  // Keep only last 20 messages
  if (history.length > 20) {
    history.shift();
  }
  
  // Clean old messages (older than 2 minutes)
  const twoMinutesAgo = Date.now() - 120000;
  const filtered = history.filter(m => m.timestamp > twoMinutesAgo);
  
  recentMessages.set(channelId, filtered);
}

function isQuestion(content: string): boolean {
  const questionPatterns = [
    /\?$/,
    /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|will|have|has)/i,
    /help/i,
    /explain/i,
    /tell me/i,
    /need to know/i,
  ];
  
  return questionPatterns.some(pattern => pattern.test(content.trim()));
}

serve(async (req) => {
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
    // Clone request to read body twice (for verification and parsing)
    const rawBody = await req.text();
    
    // Check if this is a Discord interaction (has signature headers)
    const hasSignature = req.headers.get("x-signature-ed25519");
    
    if (hasSignature) {
      // Verify Discord signature for interactions
      const isValid = await verifyDiscordSignature(req, rawBody);
      if (!isValid) {
        console.error("Invalid Discord signature");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    console.log("Received Discord event:", JSON.stringify(body, null, 2));

    // Handle Discord's URL verification (PING)
    if (body.type === 1) {
      console.log("Responding to Discord PING");
      return new Response(
        JSON.stringify({ type: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle slash commands / interactions
    // IMPORTANT: Discord requires a response within ~3 seconds.
    // We ACK immediately (type 5) and then post the real answer as a follow-up message.
    if (body.type === 2) {
      const question =
        body.data?.options?.find((o: any) => o?.name === "question")?.value ||
        body.data?.options?.[0]?.value ||
        "";

      const applicationId = body.application_id;
      const interactionToken = body.token;
      
      // Get user info from interaction
      const userId = body.member?.user?.id || body.user?.id;
      const userName = body.member?.user?.username || body.user?.username || "User";

      const run = (async () => {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseKey);

          const { data: knowledgeEntries } = await supabase
            .from("knowledge_base")
            .select("title, content, category")
            .order("category");

          const knowledgeContext = knowledgeEntries?.length
            ? knowledgeEntries
                .map((e: any) => `[${String(e.category).toUpperCase()}] ${e.title}:\n${e.content}`)
                .join("\n\n---\n\n")
            : "No knowledge base entries available.";

          // Get user's conversation history
          const userHistory = userId ? await getUserConversationHistory(supabase, userId) : [];

          const aiResponse = await getAIResponse(String(question || ""), knowledgeContext, userHistory, userName);

          // Store conversation if we have user ID
          if (userId) {
            await storeUserMessage(supabase, userId, "user", String(question || ""));
            await storeUserMessage(supabase, userId, "assistant", aiResponse);
          }

          const followup = await fetch(
            `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: aiResponse }),
            }
          );

          if (!followup.ok) {
            const t = await followup.text();
            console.error("Discord follow-up error:", followup.status, t);
          }
        } catch (e) {
          console.error("Slash command processing error:", e);
          // Best-effort error follow-up
          try {
            await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: "I'm experiencing technical difficulties. Please try again later." }),
            });
          } catch {
            // ignore
          }
        }
      })();

      const waitUntil = (globalThis as any)?.EdgeRuntime?.waitUntil;
      if (typeof waitUntil === "function") {
        waitUntil(run);
      }

      // ACK immediately
      return new Response(JSON.stringify({ type: 5 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle message create events
    if (body.event === "MESSAGE_CREATE" || body.t === "MESSAGE_CREATE") {
      const message = body.d || body.data || body;
      const channelId = message.channel_id;
      const messageId = message.id;
      const content = message.content || "";
      const authorId = message.author?.id;
      const guildId = message.guild_id || GUILD_ID;
      const isBot = message.author?.bot;
      const mentions = message.mentions || [];
      const messageTimestamp = Date.now();
      const messageReference = message.message_reference; // Reply reference

      // Don't respond to bot messages
      if (isBot) {
        console.log("Ignoring bot message");
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update message history for conversation detection
      updateMessageHistory(channelId, authorId, messageTimestamp);

      // Log the author info for debugging
      console.log(`Discord User ID: ${authorId}, Username: ${message.author?.username}`);

      // Fetch replied-to message if this is a reply
      let repliedToMessage: any = null;
      let repliedToContent = "";
      if (messageReference?.message_id) {
        console.log(`Message is a reply to: ${messageReference.message_id}`);
        repliedToMessage = await getMessageById(channelId, messageReference.message_id, DISCORD_BOT_TOKEN);
        if (repliedToMessage) {
          repliedToContent = repliedToMessage.content || "";
          console.log(`Replied-to message content: "${repliedToContent}" by ${repliedToMessage.author?.username}`);
        }
      }

      // Get author's roles
      const authorRoles = await getMemberRoles(guildId, authorId, DISCORD_BOT_TOKEN);
      const isAuthorModerator = isModeratorRole(authorRoles);
      const botIsMentioned = isBotMentioned(content, mentions);

      console.log(`Message from ${message.author?.username} (ID: ${authorId}): "${content}"`);
      console.log(`Is moderator: ${isAuthorModerator}, Bot mentioned: ${botIsMentioned}`);

      // CASE 1: Moderator tags the bot - respond immediately to moderator commands
      if (isAuthorModerator && botIsMentioned) {
        console.log("Moderator command detected - responding immediately");
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: knowledgeEntries } = await supabase
          .from("knowledge_base")
          .select("title, content, category")
          .order("category");

        let knowledgeContext = knowledgeEntries?.length
          ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n---\n\n")
          : "No knowledge base entries available.";

        // Get user's conversation history
        const userHistory = await getUserConversationHistory(supabase, authorId);
        const userName = message.author?.username || "User";

        // Remove bot mention from content before sending to AI
        let cleanContent = content.replace(/<@!?\d+>/g, "").trim();
        
        // Build reply context if replying to a message
        const replyContext = repliedToMessage ? {
          content: repliedToContent,
          authorName: repliedToMessage.author?.username || "Unknown User"
        } : undefined;
        
        // If user just tagged the bot with no message but replied to a message, use the replied message as the question
        if (!cleanContent && repliedToContent) {
          console.log(`User just tagged bot - using replied message as question: "${repliedToContent}"`);
          cleanContent = `Please answer this question: "${repliedToContent}"`;
        }
        
        // If still no content, ask for a question
        if (!cleanContent) {
          await sendDiscordMessage(channelId, "Hey! 👋 What would you like to know? Just include your question and I'll help you out! 🎯", DISCORD_BOT_TOKEN, messageId);
          return new Response(JSON.stringify({ success: true, action: "no_question" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const aiResponse = await getAIResponse(cleanContent, knowledgeContext, userHistory, userName, replyContext);

        await sendDiscordMessage(channelId, aiResponse, DISCORD_BOT_TOKEN, messageId);

        // Store in user-specific chat history
        await storeUserMessage(supabase, authorId, "user", cleanContent);
        await storeUserMessage(supabase, authorId, "assistant", aiResponse);
        
        return new Response(JSON.stringify({ success: true, action: "moderator_command" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CASE 2: Regular moderator message (not tagging bot) - stay silent
      if (isAuthorModerator && !botIsMentioned) {
        console.log("Moderator message - staying silent");
        return new Response(JSON.stringify({ success: true, action: "ignored_moderator_message" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CASE 3: User directly mentions the bot - respond immediately
      if (botIsMentioned) {
        console.log("Bot mentioned by user - responding immediately");
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: knowledgeEntries } = await supabase
          .from("knowledge_base")
          .select("title, content, category")
          .order("category");

        let knowledgeContext = knowledgeEntries?.length
          ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n---\n\n")
          : "No knowledge base entries available.";

        // Get user's conversation history
        const userHistory = await getUserConversationHistory(supabase, authorId);
        const userName = message.author?.username || "User";

        // Remove bot mention from content before sending to AI
        let cleanContent = content.replace(/<@!?\d+>/g, "").trim();
        
        // Build reply context if replying to a message
        const replyContext = repliedToMessage ? {
          content: repliedToContent,
          authorName: repliedToMessage.author?.username || "Unknown User"
        } : undefined;
        
        // If user just tagged the bot with no message but replied to a message, use the replied message as the question
        if (!cleanContent && repliedToContent) {
          console.log(`User just tagged bot - using replied message as question: "${repliedToContent}"`);
          cleanContent = `Please answer this question: "${repliedToContent}"`;
        }
        
        // If still no content, ask for a question
        if (!cleanContent) {
          await sendDiscordMessage(channelId, "Hey! 👋 What would you like to know? Just include your question and I'll help you out! 🎯", DISCORD_BOT_TOKEN, messageId);
          return new Response(JSON.stringify({ success: true, action: "no_question" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        const aiResponse = await getAIResponse(cleanContent, knowledgeContext, userHistory, userName, replyContext);

        await sendDiscordMessage(channelId, aiResponse, DISCORD_BOT_TOKEN, messageId);

        // Store in user-specific chat history
        await storeUserMessage(supabase, authorId, "user", cleanContent);
        await storeUserMessage(supabase, authorId, "assistant", aiResponse);

        return new Response(JSON.stringify({ success: true, action: "user_mentioned_bot" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CASE 4: Detect ongoing conversation between users - stay silent
      if (isConversation(channelId, authorId, messageTimestamp)) {
        console.log("Ongoing conversation detected - staying silent");
        return new Response(JSON.stringify({ success: true, action: "ignored_conversation" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // CASE 5: Regular user message that looks like a question - respond with delay
      if (!isQuestion(content)) {
        console.log("Message doesn't appear to be a question - staying silent");
        return new Response(JSON.stringify({ success: true, action: "not_a_question" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Question detected, waiting ${MODERATOR_DELAY_MS}ms before responding...`);
      
      // Wait 15 seconds
      await new Promise((resolve) => setTimeout(resolve, MODERATOR_DELAY_MS));

      // Check if a moderator replied during the wait
      const newMessages = await getChannelMessagesAfter(channelId, messageId, DISCORD_BOT_TOKEN);
      
      for (const msg of newMessages) {
        if (msg.author?.bot) continue;
        
        const roles = await getMemberRoles(guildId, msg.author.id, DISCORD_BOT_TOKEN);
        if (isModeratorRole(roles)) {
          console.log(`Moderator ${msg.author?.username} replied during wait - staying silent`);
          return new Response(JSON.stringify({ success: true, action: "moderator_handled" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // No moderator replied - send response
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      let knowledgeContext = knowledgeEntries?.length
        ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n---\n\n")
        : "No knowledge base entries available.";

      // Get user's conversation history
      const userHistory = await getUserConversationHistory(supabase, authorId);
      const userName = message.author?.username || "User";
      
      // Build reply context if replying to a message
      const replyContext = repliedToMessage ? {
        content: repliedToContent,
        authorName: repliedToMessage.author?.username || "Unknown User"
      } : undefined;

      const aiResponse = await getAIResponse(content, knowledgeContext, userHistory, userName, replyContext);
      await sendDiscordMessage(channelId, aiResponse, DISCORD_BOT_TOKEN, messageId);

      // Store in user-specific chat history
      await storeUserMessage(supabase, authorId, "user", content);
      await storeUserMessage(supabase, authorId, "assistant", aiResponse);

      return new Response(JSON.stringify({ success: true, action: "responded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle register commands action
    if (body.action === "register_commands") {
      try {
        await registerGuildSlashCommands(DISCORD_BOT_TOKEN);
        return new Response(
          JSON.stringify({ success: true, message: "Registered /ask command" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({
            success: false,
            error: e instanceof Error ? e.message : "Failed to register commands",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Handle gateway_message action (from gateway bot)
    if (body.action === "gateway_message") {
      const { discordUserId, username, message, repliedToContent, repliedToAuthor } = body;
      
      console.log(`Gateway message from ${username} (${discordUserId}): "${message}"`);
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      const knowledgeContext = knowledgeEntries?.length
        ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n---\n\n")
        : "No knowledge base entries available.";

      // Get user's conversation history (up to 20 messages)
      const userHistory = discordUserId ? await getUserConversationHistory(supabase, discordUserId, 20) : [];
      console.log(`Found ${userHistory.length} messages in history for user ${discordUserId}`);

      // Build reply context if present
      const replyContext = repliedToContent ? {
        content: repliedToContent,
        authorName: repliedToAuthor || "Unknown User"
      } : undefined;

      const aiResponse = await getAIResponse(message, knowledgeContext, userHistory, username, replyContext);

      // Store conversation for memory
      if (discordUserId) {
        await storeUserMessage(supabase, discordUserId, "user", message);
        await storeUserMessage(supabase, discordUserId, "assistant", aiResponse);
      }

      return new Response(
        JSON.stringify({ success: true, response: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle test action
    if (body.action === "test") {
      const testMessage = body.message || "What are the drawdown rules?";

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      let knowledgeContext = knowledgeEntries?.length
        ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n---\n\n")
        : "No knowledge base entries available.";

      const aiResponse = await getAIResponse(testMessage, knowledgeContext);

      return new Response(
        JSON.stringify({ success: true, question: testMessage, response: aiResponse }),
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