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

**DISCORD FORMATTING (CRITICAL - Make responses visually appealing):**

1. **Use Discord Markdown for Visual Hierarchy:**
   - Use **bold** for key terms, prices, and important info
   - Use bullet points (•) or dashes (-) for lists
   - Use > for blockquotes when quoting rules or policies

2. **Structure Your Responses:**
   - Start with a friendly greeting line
   - Leave a blank line after the greeting
   - Use short paragraphs (2-3 sentences max)
   - Leave blank lines between sections for readability

3. **For Pricing/Data Tables:**
   - Use clear headers with **bold**
   - Format as clean lists, NOT markdown tables (Discord doesn't render tables well)
   - Example:
     **Maven Challenges:**
     • 2K → $29 (₹2,610)
     • 5K → $49 (₹4,410)
     • 10K → $99 (₹8,910)

4. **For Step-by-Step Info:**
   - Number your steps clearly
   - Bold the action word
   - Example:
     **1.** Visit propscholar.com
     **2.** Select your challenge
     **3.** Complete checkout

5. **Spacing Rules (MANDATORY):**
   - Always leave ONE blank line between paragraphs
   - Always leave ONE blank line before and after lists
   - Never have walls of text - break it up!

6. **Link Formatting:**
   - NEVER use markdown links [text](url) - Discord shows them literally
   - Just paste URLs directly: https://help.propscholar.com
   - Add a description before the link

7. **Example Well-Formatted Response:**
   Hey there! Great question about our challenges 🎯

   Here's what you need to know:

   **Available Sizes:**
   • 2K Challenge → $29 (₹2,610)
   • 5K Challenge → $49 (₹4,410)
   • 10K Challenge → $99 (₹8,910)

   All challenges come with:
   - No time limits ⏰
   - Unlimited retakes
   - Fast payouts 💰

   Check out more details here: https://help.propscholar.com/article/challenge-pricing-rewards

   Let me know if you have any other questions! 🚀

SMART FOLLOW-UPS:
- When relevant, suggest 1-2 related topics the user might want to know about
- Only do this when it genuinely adds value, not for every response
- Format: "By the way, you might also want to know about [topic]! Want me to explain?"
- Examples: After explaining payouts → mention withdrawal process; After explaining rules → mention trading tips

ACTIVE COUPONS & DISCOUNTS:
{coupons_context}

When users ask about discounts, deals, coupon codes, promo codes, or savings - share the active coupons above!
Present them nicely with the code, discount percentage, and benefits. Make it exciting! 🎉

KNOWLEDGE BASE:
{knowledge_base}

{learned_corrections}

Make every trader feel like they've got a friend on the inside who actually cares about their success 🚀`;

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface DiscordUserProfile {
  id: string;
  discord_user_id: string;
  username: string;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  message_count: number;
  notes: string | null;
}

async function getOrCreateUserProfile(
  supabase: any,
  discordUserId: string,
  username: string,
  displayName?: string
): Promise<DiscordUserProfile | null> {
  console.log(`[UserProfile] Getting/creating profile for ${username} (${discordUserId})`);
  
  try {
    // Try to get existing profile
    const { data: existing, error: fetchError } = await supabase
      .from("discord_users")
      .select("*")
      .eq("discord_user_id", discordUserId)
      .maybeSingle();

    if (fetchError) {
      console.error("[UserProfile] Error fetching user profile:", JSON.stringify(fetchError));
      return null;
    }

    if (existing) {
      console.log(`[UserProfile] Found existing profile, updating...`);
      // Update last_seen and increment message_count
      const { data: updated, error: updateError } = await supabase
        .from("discord_users")
        .update({
          username,
          display_name: displayName || existing.display_name,
          last_seen_at: new Date().toISOString(),
          message_count: (existing.message_count || 0) + 1,
        })
        .eq("discord_user_id", discordUserId)
        .select()
        .single();

      if (updateError) {
        console.error("[UserProfile] Error updating user profile:", JSON.stringify(updateError));
        return existing;
      }

      console.log(`[UserProfile] Updated profile for ${username}, message count: ${updated.message_count}`);
      return updated;
    }

    // Create new profile
    console.log(`[UserProfile] No existing profile found, creating new one...`);
    const { data: newProfile, error: insertError } = await supabase
      .from("discord_users")
      .insert({
        discord_user_id: discordUserId,
        username,
        display_name: displayName,
        message_count: 1,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[UserProfile] Error creating user profile:", JSON.stringify(insertError));
      return null;
    }

    console.log(`[UserProfile] Created new profile for ${username} (${discordUserId})`);
    return newProfile;
  } catch (e) {
    console.error("[UserProfile] Exception in getOrCreateUserProfile:", e);
    return null;
  }
}

function buildUserContextPrompt(profile: DiscordUserProfile | null): string {
  if (!profile) return "";
  
  const firstSeen = new Date(profile.first_seen_at);
  const daysSinceFirst = Math.floor((Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));
  const isNew = profile.message_count <= 3;
  const isRegular = profile.message_count > 10;
  
  let context = `\n\nUSER PROFILE:
- Name: ${profile.username}${profile.display_name ? ` (${profile.display_name})` : ""}
- Messages sent: ${profile.message_count}
- First seen: ${firstSeen.toLocaleDateString()} (${daysSinceFirst === 0 ? "today" : daysSinceFirst === 1 ? "yesterday" : `${daysSinceFirst} days ago`})`;

  if (profile.notes) {
    context += `\n- Notes: ${profile.notes}`;
  }

  if (isNew) {
    context += `\n\nThis is a newer user - be extra welcoming and helpful! Make them feel like part of the PropScholar community.`;
  } else if (isRegular) {
    context += `\n\nThis is a regular user who's been around! Feel free to be more familiar and reference that you remember them.`;
  }

  return context;
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

// Fetch learned corrections from training feedback for auto-learning
async function getLearnedCorrections(
  supabase: any,
  userQuestion: string
): Promise<string> {
  try {
    // Get corrected answers that have been reviewed
    const { data: corrections, error } = await supabase
      .from("training_feedback")
      .select("question, corrected_answer")
      .eq("is_correct", false)
      .not("corrected_answer", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(20);

    if (error || !corrections || corrections.length === 0) {
      return "";
    }

    // Simple keyword matching to find relevant corrections
    const userWords = userQuestion.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const relevantCorrections = corrections.filter((c: any) => {
      const questionWords = c.question.toLowerCase();
      return userWords.some((word: string) => questionWords.includes(word));
    }).slice(0, 5);

    if (relevantCorrections.length === 0) {
      return "";
    }

    const correctionsText = relevantCorrections.map((c: any) => 
      `Q: ${c.question}\nCorrect Answer: ${c.corrected_answer}`
    ).join("\n\n");

    return `\n\nLEARNED CORRECTIONS (Use these verified answers for similar questions):\n${correctionsText}`;
  } catch (e) {
    console.error("Error fetching learned corrections:", e);
    return "";
  }
}

// Fetch active coupons for the bot to share
async function getActiveCoupons(supabase: any): Promise<string> {
  try {
    const { data: coupons, error } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, description, benefits, min_purchase, valid_until")
      .eq("is_active", true)
      .or("valid_until.is.null,valid_until.gt." + new Date().toISOString());

    if (error) {
      console.error("Error fetching coupons:", error);
      return "No active coupons at the moment.";
    }

    if (!coupons || coupons.length === 0) {
      return "No active coupons at the moment.";
    }

    console.log(`Found ${coupons.length} active coupon(s)`);
    
    return coupons
      .map((c: any) => {
        const discount = c.discount_type === "percentage" 
          ? `${c.discount_value}% off` 
          : `$${c.discount_value} off`;
        let info = `• Code: **${c.code}** - ${discount}`;
        if (c.description) info += `\n  Description: ${c.description}`;
        if (c.benefits) info += `\n  Benefits: ${c.benefits}`;
        if (c.min_purchase && c.min_purchase > 0) info += `\n  Min purchase: $${c.min_purchase}`;
        if (c.valid_until) info += `\n  Expires: ${new Date(c.valid_until).toLocaleDateString()}`;
        return info;
      })
      .join("\n\n");
  } catch (e) {
    console.error("Error fetching coupons:", e);
    return "No active coupons at the moment.";
  }
}

async function getAIResponse(
  message: string,
  knowledgeContext: string,
  conversationHistory: ConversationMessage[] = [],
  userName?: string,
  repliedTo?: ReplyContext,
  userProfile?: DiscordUserProfile | null,
  learnedCorrections: string = "",
  couponsContext: string = "No active coupons at the moment."
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "I'm experiencing technical difficulties. Please try again later.";
  }

  let systemPrompt = SYSTEM_PROMPT
    .replace("{knowledge_base}", knowledgeContext)
    .replace("{learned_corrections}", learnedCorrections)
    .replace("{coupons_context}", couponsContext);
  
  // Add user profile context
  if (userProfile) {
    systemPrompt += buildUserContextPrompt(userProfile);
  }
  
  // Add conversation history context
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

// Autobot system prompt - more professional, human-like tone
const AUTOBOT_SYSTEM_PROMPT = `You are a helpful PropScholar assistant with a professional, human-like tone. You respond naturally as if you're a knowledgeable team member who happens to be available.

YOUR TONE:
- Professional but warm - like a colleague helping out
- Natural and conversational - not robotic or overly formal
- Helpful and informative - get to the point
- Use occasional emojis but sparingly (1-2 max per response)

HOW TO RESPOND:
- Keep responses concise and helpful
- Get straight to answering the question
- Sound like a real person, not an AI
- If you don't know something, say so naturally: "I'm not 100% sure on that one - you might want to reach out to the team directly"

EXAMPLES OF GOOD RESPONSES:
- "Good question! The drawdown rules are..." ✓
- "Hey! So for that, you'll want to..." ✓  
- "That's actually pretty straightforward - here's how it works..." ✓

RULES:
- Never make up facts or policies
- Use the knowledge base for accurate information
- If asked about something not in your knowledge base, be honest about it
- Keep it professional - you represent PropScholar

ACTIVE COUPONS:
{coupons_context}

KNOWLEDGE BASE:
{knowledge_base}

{learned_corrections}`;

async function getAutobotAIResponse(
  message: string,
  knowledgeContext: string,
  conversationHistory: ConversationMessage[] = [],
  userName?: string,
  repliedTo?: ReplyContext,
  userProfile?: DiscordUserProfile | null,
  learnedCorrections: string = "",
  couponsContext: string = "No active coupons at the moment."
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return "I'm having some technical difficulties - please try again in a moment.";
  }

  let systemPrompt = AUTOBOT_SYSTEM_PROMPT
    .replace("{knowledge_base}", knowledgeContext)
    .replace("{learned_corrections}", learnedCorrections)
    .replace("{coupons_context}", couponsContext);
  
  // Add user profile context
  if (userProfile) {
    systemPrompt += buildUserContextPrompt(userProfile);
  }
  
  // Add conversation history context
  if (conversationHistory.length > 0 && userName) {
    systemPrompt += `\n\nYou're continuing a conversation with ${userName}. Use this context to provide personalized responses.`;
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
      console.error("[Autobot] AI Gateway error:", response.status);
      return "I'm having some technical difficulties - please try again in a moment.";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("[Autobot] Error calling AI:", error);
    return "I'm having some technical difficulties - please try again in a moment.";
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
  // Register /ask and /autobot commands in the configured guild.
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
    {
      name: "autobot",
      description: "Toggle the auto-reply bot on or off",
      options: [
        {
          type: 3, // STRING
          name: "action",
          description: "Turn autobot on or off",
          required: true,
          choices: [
            { name: "on", value: "on" },
            { name: "off", value: "off" },
            { name: "status", value: "status" },
          ],
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
      const commandName = body.data?.name;
      const applicationId = body.application_id;
      const interactionToken = body.token;
      
      // Get user info from interaction
      const userId = body.member?.user?.id || body.user?.id;
      const userName = body.member?.user?.username || body.user?.username || "User";

      // Handle /autobot command
      if (commandName === "autobot") {
        const action = body.data?.options?.find((o: any) => o?.name === "action")?.value || "status";
        
        const run = (async () => {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Get current settings
            const { data: settings, error: fetchError } = await supabase
              .from("autobot_settings")
              .select("*")
              .limit(1)
              .single();

            if (fetchError || !settings) {
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: "⚠️ Autobot settings not found. Please configure in the admin dashboard first." }),
              });
              return;
            }

            if (action === "status") {
              const statusEmoji = settings.is_enabled ? "🟢" : "🔴";
              const statusText = settings.is_enabled ? "ACTIVE" : "INACTIVE";
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                  content: `${statusEmoji} **Autobot Status: ${statusText}**\n\n• Delay: ${settings.delay_seconds}s\n• Bot Name: ${settings.bot_name}\n\nUse \`/autobot on\` or \`/autobot off\` to toggle.` 
                }),
              });
              return;
            }

            const newEnabled = action === "on";
            
            // Update settings
            const { error: updateError } = await supabase
              .from("autobot_settings")
              .update({ is_enabled: newEnabled })
              .eq("id", settings.id);

            if (updateError) {
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: "⚠️ Failed to update autobot settings. Please try again." }),
              });
              return;
            }

            const emoji = newEnabled ? "🟢" : "🔴";
            const message = newEnabled 
              ? `${emoji} **Autobot is now ACTIVE!**\n\nI'll automatically respond to unanswered questions after ${settings.delay_seconds} seconds.`
              : `${emoji} **Autobot is now INACTIVE.**\n\nI won't auto-reply to messages. Tag me with @Scholaris to ask questions!`;

            await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: message }),
            });
          } catch (e) {
            console.error("Autobot command error:", e);
            try {
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: "⚠️ An error occurred. Please try again." }),
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

        return new Response(JSON.stringify({ type: 5 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle /ask command
      const question =
        body.data?.options?.find((o: any) => o?.name === "question")?.value ||
        body.data?.options?.[0]?.value ||
        "";

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

          // Get or create user profile
          const displayName = body.member?.user?.global_name || body.user?.global_name;
          const userProfile = userId ? await getOrCreateUserProfile(supabase, userId, userName, displayName) : null;

          // Get user's conversation history
          const userHistory = userId ? await getUserConversationHistory(supabase, userId) : [];

          // Fetch learned corrections for auto-learning
          const learnedCorrections = await getLearnedCorrections(supabase, String(question || ""));

          // Fetch active coupons
          const couponsContext = await getActiveCoupons(supabase);

          const aiResponse = await getAIResponse(String(question || ""), knowledgeContext, userHistory, userName, undefined, userProfile, learnedCorrections, couponsContext);

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

        // Get or create user profile
        const displayName = message.author?.global_name;
        const userProfile = await getOrCreateUserProfile(supabase, authorId, message.author?.username || "User", displayName);

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
        
        // Fetch learned corrections for auto-learning
        const learnedCorrections = await getLearnedCorrections(supabase, cleanContent);
        
        // Fetch active coupons
        const couponsContext = await getActiveCoupons(supabase);
        
        const aiResponse = await getAIResponse(cleanContent, knowledgeContext, userHistory, userName, replyContext, userProfile, learnedCorrections, couponsContext);

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

        // Get or create user profile
        const displayName = message.author?.global_name;
        const userProfile = await getOrCreateUserProfile(supabase, authorId, message.author?.username || "User", displayName);

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
        
        // Fetch learned corrections for auto-learning
        const learnedCorrections = await getLearnedCorrections(supabase, cleanContent);
        
        // Fetch active coupons
        const couponsContext = await getActiveCoupons(supabase);
        
        const aiResponse = await getAIResponse(cleanContent, knowledgeContext, userHistory, userName, replyContext, userProfile, learnedCorrections, couponsContext);

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

      // Get or create user profile
      const displayName = message.author?.global_name;
      const userProfile = await getOrCreateUserProfile(supabase, authorId, message.author?.username || "User", displayName);

      // Get user's conversation history
      const userHistory = await getUserConversationHistory(supabase, authorId);
      const userName = message.author?.username || "User";
      
      // Build reply context if replying to a message
      const replyContext = repliedToMessage ? {
        content: repliedToContent,
        authorName: repliedToMessage.author?.username || "Unknown User"
      } : undefined;

      // Fetch learned corrections for auto-learning
      const learnedCorrections = await getLearnedCorrections(supabase, content);

      // Fetch active coupons
      const couponsContext = await getActiveCoupons(supabase);

      const aiResponse = await getAIResponse(content, knowledgeContext, userHistory, userName, replyContext, userProfile, learnedCorrections, couponsContext);
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
      const {
        discordUserId,
        username,
        displayName,
        message,
        repliedToContent,
        repliedToAuthor,
      } = body;

      console.log(`Gateway message from ${username} (${discordUserId}): "${message}"`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      const knowledgeContext = knowledgeEntries?.length
        ? knowledgeEntries
            .map((e) => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`)
            .join("\n\n---\n\n")
        : "No knowledge base entries available.";

      // Get or create user profile (persistent)
      const userProfile = discordUserId
        ? await getOrCreateUserProfile(
            supabase,
            discordUserId,
            username || "User",
            displayName
          )
        : null;

      // Get user's conversation history (up to 20 messages)
      const userHistory = discordUserId
        ? await getUserConversationHistory(supabase, discordUserId, 20)
        : [];
      console.log(`Found ${userHistory.length} messages in history for user ${discordUserId}`);

      // Build reply context if present
      const replyContext = repliedToContent
        ? {
            content: repliedToContent,
            authorName: repliedToAuthor || "Unknown User",
          }
        : undefined;

      // Fetch learned corrections for auto-learning
      const learnedCorrections = await getLearnedCorrections(supabase, message);

      // Fetch active coupons
      const couponsContext = await getActiveCoupons(supabase);

      const aiResponse = await getAIResponse(
        message,
        knowledgeContext,
        userHistory,
        username,
        replyContext,
        userProfile,
        learnedCorrections,
        couponsContext
      );

      // Store conversation for memory
      if (discordUserId) {
        await storeUserMessage(supabase, discordUserId, "user", message);
        await storeUserMessage(supabase, discordUserId, "assistant", aiResponse);
      }

      return new Response(JSON.stringify({ success: true, response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle autobot_message action (from gateway bot - professional human tone)
    if (body.action === "autobot_message") {
      const {
        discordUserId,
        username,
        displayName,
        message,
        repliedToContent,
        repliedToAuthor,
      } = body;

      console.log(`[Autobot] Message from ${username} (${discordUserId}): "${message}"`);

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: knowledgeEntries } = await supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category");

      const knowledgeContext = knowledgeEntries?.length
        ? knowledgeEntries
            .map((e) => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`)
            .join("\n\n---\n\n")
        : "No knowledge base entries available.";

      // Get or create user profile
      const userProfile = discordUserId
        ? await getOrCreateUserProfile(
            supabase,
            discordUserId,
            username || "User",
            displayName
          )
        : null;

      // Get user's conversation history
      const userHistory = discordUserId
        ? await getUserConversationHistory(supabase, discordUserId, 20)
        : [];

      // Build reply context if present
      const replyContext = repliedToContent
        ? {
            content: repliedToContent,
            authorName: repliedToAuthor || "Unknown User",
          }
        : undefined;

      // Fetch learned corrections
      const learnedCorrections = await getLearnedCorrections(supabase, message);

      // Fetch active coupons
      const couponsContext = await getActiveCoupons(supabase);

      // Use autobot-specific AI response (more professional, human tone)
      const aiResponse = await getAutobotAIResponse(
        message,
        knowledgeContext,
        userHistory,
        username,
        replyContext,
        userProfile,
        learnedCorrections,
        couponsContext
      );

      // Store conversation for memory
      if (discordUserId) {
        await storeUserMessage(supabase, discordUserId, "user", message);
        await storeUserMessage(supabase, discordUserId, "assistant", aiResponse);
      }

      return new Response(JSON.stringify({ success: true, response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      // Fetch learned corrections for auto-learning
      const learnedCorrections = await getLearnedCorrections(supabase, testMessage);

      // Fetch active coupons
      const couponsContext = await getActiveCoupons(supabase);

      const aiResponse = await getAIResponse(testMessage, knowledgeContext, [], undefined, undefined, undefined, learnedCorrections, couponsContext);

      return new Response(
        JSON.stringify({ success: true, question: testMessage, response: aiResponse }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle Schola (PS MOD) test mode from admin test arena
    if (body.mode === "ps-mod") {
      const testMessage = body.message || "Test question";
      const systemPromptOverride = body.systemPromptOverride;

      console.log(`[Schola Test] Testing with message: "${testMessage}"`);

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

      // Fetch learned corrections
      const learnedCorrections = await getLearnedCorrections(supabase, testMessage);

      // Fetch active coupons
      const couponsContext = await getActiveCoupons(supabase);

      // Use custom system prompt if provided (Schola's personality)
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const systemPrompt = systemPromptOverride 
        ? systemPromptOverride + `\n\nKNOWLEDGE BASE:\n${knowledgeContext}\n\nACTIVE COUPONS:\n${couponsContext}${learnedCorrections}`
        : `You are Schola, a helpful PropScholar assistant.\n\nKNOWLEDGE BASE:\n${knowledgeContext}\n\nACTIVE COUPONS:\n${couponsContext}${learnedCorrections}`;

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
            { role: "user", content: testMessage },
          ],
        }),
      });

      if (!response.ok) {
        console.error("[Schola Test] AI Gateway error:", response.status);
        return new Response(
          JSON.stringify({ error: "AI Gateway error", status: response.status }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || "No response generated.";

      console.log(`[Schola Test] Response generated successfully`);

      return new Response(
        JSON.stringify({ success: true, response: aiResponse }),
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