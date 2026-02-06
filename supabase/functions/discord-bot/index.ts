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

function sanitizeDiscordPromptText(text: string): string {
  // This is used ONLY for model context (history / learned corrections), not user-facing output.
  // Goal: prevent cross-user name bleed and reduce "addressing" artifacts.
  return (text || "")
    // Strip Discord user mentions
    .replace(/<@!?\d+>/g, "")
    // Strip @handles ONLY when they look like a Discord mention (keep emails intact)
    .replace(/(^|\s)@[\w._-]{2,32}\b/gm, "$1")
    // Strip greeting lines that tend to introduce/randomly address names
    .replace(/^(?:hey|hi|hello)\b[^\n]{0,240}\n+/gim, "")
    // Avoid divider noise in context
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Clean Discord response - normalize formatting for Discord rendering
function cleanDiscordResponse(text: string): string {
  let cleaned = (text || "")
    // Remove horizontal rules (--- / *** / ___) - Discord rendering is inconsistent
    .replace(/^\s*[-*_]{3,}\s*$/gm, "")
    .replace(/\n\s*[-*_]{3,}\s*\n/g, "\n\n")
    // Remove common ASCII/box divider lines
    .replace(/^\s*[═━─]{8,}\s*$/gm, "")
    // Convert bullets to quote blocks (Discord-native)
    .replace(/^[\t ]*[•●]\s*/gm, "> ")
    .replace(/^[\t ]*[-*]\s+/gm, "> ")
    // Normalize arrows
    .replace(/→/g, "—")
    // Avoid markdown links - flatten to plain URL
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 — $2")
    // Normalize heading levels to ## (Discord-friendly + consistent)
    .replace(/^#\s+/gm, "## ")
    .replace(/^###\s+/gm, "## ")
    // Remove trailing ':' in headers
    .replace(/^(##\s+.+):\s*$/gm, "$1")
    // Ensure a blank line after headers
    .replace(/^(##[^\n]+)\n(?!\n)/gm, "$1\n\n")
    // Flatten nested quote blocks ("> >") to a single quote level
    .replace(/^[\t ]*>\s*>\s*/gm, "> ")
    // Inside quote blocks, remove "- " bullets for cleaner rendering
    .replace(/^>\s*[-*]\s+/gm, "> ")
    // Strip Discord mentions that sometimes leak through the model output
    .replace(/<@!?\d+>/g, "")
    // Limit consecutive newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Strip greeting/preamble paragraphs anywhere (they often contain random names).
  cleaned = cleaned
    // First paragraph preamble
    .replace(/^(?:hey|hi|hello|absolutely|great question)[^\n]{0,240}\n\n/gi, "")
    // Any standalone greeting paragraph later in the message
    .replace(/(\n\n|^)(?:hey|hi|hello)\b[^\n]{0,80}(!|\.)\s*\n\n/gi, "$1")
    .trim();

  // Remove common "ask for more" closers (user requested: full answer, no follow-up prompting).
  cleaned = cleaned
    .replace(/\n?\s*for more (?:info|information)[^\n]*$/i, "")
    .replace(/\n?\s*feel free to ask[^\n]*$/i, "")
    .replace(/\n?\s*let me know if you (?:have|need)[^\n]*$/i, "")
    .replace(/\n?\s*want me to[^\n]*\?\s*$/i, "")
    .trim();

  // Force a clean, Discord-native start.
  if (!/^##\s+/m.test(cleaned)) {
    cleaned = `## Quick answer\n\n${cleaned}`.trim();
  }

  // Safety cap only (gateway bot will split into 2000-char Discord messages).
  const MAX = 8000;
  if (cleaned.length <= MAX) return cleaned;

  // Prefer cutting at a paragraph boundary if possible.
  const slice = cleaned.slice(0, MAX);
  const cutAt = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"));
  const truncated = (cutAt > 200 ? slice.slice(0, cutAt) : slice).trimEnd();
  return truncated + "\n\n…";
}

const SYSTEM_PROMPT = `You are Scholaris AI, PropScholar's official Discord support.

CRITICAL OUTPUT REQUIREMENTS:
- Give the FULL answer in one response (do not ask the user to follow up).
- Start immediately with the answer. No greeting. No fluff.
- Never address the user by name.

DISCORD MARKDOWN (MANDATORY):
- First line MUST be: ## Quick answer
- Use ONLY ## headers for section titles (no #, no ###).
- Use > quote blocks for lists / key points.
- NEVER use divider lines like --- / *** / ___.
- Use **bold** sparingly for prices, limits, rule names, and key terms.
- Use — (em dash) instead of arrows.

STYLE:
- Be concise but complete: cover all key facts and rules the user asked for.
- Do NOT end with: "feel free to ask", "want more detail", "let me know".
- Only ask a question back if a missing detail makes the answer impossible.

SUGGESTED STRUCTURE:
## Quick answer
1–3 sentences.

## Details
> Item
> Item

## Links (only if relevant)
Paste full URLs.

RULES:
- Never invent facts; if unsure: "Let me check with the team."
- Respond ONLY to the user who asked; never mention or address other users.

ACTIVE COUPONS:
{coupons_context}

KNOWLEDGE:
{knowledge_base}

{learned_corrections}`;

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

  let context = `\n\nUSER PROFILE (for internal context only):
- Messages sent: ${profile.message_count}
- First seen: ${firstSeen.toLocaleDateString()} (${daysSinceFirst === 0 ? "today" : daysSinceFirst === 1 ? "yesterday" : `${daysSinceFirst} days ago`})`;

  if (profile.notes) {
    context += `\n- Notes: ${profile.notes}`;
  }

  // IMPORTANT: Do not include usernames/display names in the prompt.
  // The bot must never address people by name to avoid "random name" bleed.
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
    const userWords = userQuestion
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const relevantCorrections = corrections
      .filter((c: any) => {
        const questionWords = String(c.question || "").toLowerCase();
        return userWords.some((word: string) => questionWords.includes(word));
      })
      .slice(0, 5);

    if (relevantCorrections.length === 0) {
      return "";
    }

    // IMPORTANT: Only include the verified answers (not the original questions), and sanitize
    // to avoid leaking other usernames into the model context.
    const answers = relevantCorrections
      .map((c: any) => sanitizeDiscordPromptText(String(c.corrected_answer || "")))
      .filter(Boolean);

    if (answers.length === 0) {
      return "";
    }

    const correctionsText = answers
      .map((a, i) => `(${i + 1}) ${a}`)
      .join("\n\n");

    return `\n\nLEARNED CORRECTIONS (Verified answers for similar questions; do not mention usernames):\n${correctionsText}`;
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

    // IMPORTANT: format coupons in Discord-native style (no bullets / dividers).
    return coupons
      .map((c: any) => {
        const discount = c.discount_type === "percentage"
          ? `${c.discount_value}% off`
          : `$${c.discount_value} off`;
        const lines: string[] = [];
        lines.push(`> **${c.code}** — ${discount}`);
        if (c.description) lines.push(`> ${c.description}`);
        if (c.benefits) lines.push(`> Benefits: ${c.benefits}`);
        if (c.min_purchase && c.min_purchase > 0) lines.push(`> Min purchase: $${c.min_purchase}`);
        if (c.valid_until) lines.push(`> Expires: ${new Date(c.valid_until).toLocaleDateString()}`);
        return lines.join("\n");
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

  // Add conversation continuity context (no names)
  if (conversationHistory.length > 0) {
    systemPrompt +=
      "\n\nYou are continuing a conversation with the same Discord user. Use the prior messages for continuity, but do not greet or address anyone by name.";
  }

  // Build messages array with history
  const messages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add conversation history (sanitized to prevent old name bleed)
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: sanitizeDiscordPromptText(msg.content) });
  }

  // Build current message with reply context if present
  let currentMessage = message;
  if (repliedTo && repliedTo.content) {
    // Only add context, don't mention other usernames to avoid confusion
    const ctx = sanitizeDiscordPromptText(repliedTo.content);
    currentMessage = `Context from previous message: "${ctx}"\n\nMy question: ${message}`;
    console.log(`Including reply context in AI message`);
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
        // Prevent "half-cut" answers by allowing a larger output.
        max_tokens: 1400,
      }),
    });

    if (!response.ok) {
      console.error("AI Gateway error:", response.status);
      return "I'm experiencing technical difficulties. Please try again later.";
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "I couldn't generate a response.";
    return cleanDiscordResponse(rawContent);
  } catch (error) {
    console.error("Error calling AI:", error);
    return "I'm experiencing technical difficulties. Please try again later.";
  }
}

// Autobot system prompt - friendly and warm
const AUTOBOT_SYSTEM_PROMPT = `You are a helpful PropScholar assistant with a friendly, warm tone.

YOUR TONE:
- Always greet warmly: "Hey!", "Hello!", "Yes sir, how can I help?"
- Friendly and approachable - like a helpful team member
- Professional but never robotic or curt
- Use 1-2 emojis naturally to add warmth

HOW TO RESPOND:
- ALWAYS start with a friendly acknowledgment
- Keep responses concise but WARM
- Use phrases like "Absolutely!", "Of course!", "Happy to help!" 
- Sound like a real person who genuinely wants to help

EXAMPLES OF GOOD RESPONSES:
- "Hey! 👋 Great question! The drawdown rules are..." ✓
- "Yes sir, happy to help! So for that..." ✓  
- "Hello there! Let me break that down for you..." ✓

BAD RESPONSES (NEVER do this):
- "Hey. What's up?" ✗ (too curt)
- "The drawdown is 5%." ✗ (no greeting)

RULES:
- Never make up facts or policies
- Use the knowledge base for accurate information
- If you don't know something, say: "I'm not 100% sure on that one - you might want to tag @Scholaris for the full details! 🎯"
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
  // IMPORTANT: Only treat as a mention if it's explicitly present in the message text.
  // Discord replies and some relayed event payloads can include users in `mentions` even when
  // the author didn't actually type an @mention, which caused Scholaris to respond “without tag”.
  const explicit =
    content.includes(`<@${BOT_USER_ID}>`) || content.includes(`<@!${BOT_USER_ID}>`);

  // If it looks like a mention only via mentions-array, log it for diagnostics but do NOT respond.
  if (!explicit && mentions && mentions.some((m: any) => m?.id === BOT_USER_ID)) {
    console.log(
      `[MentionCheck] mentions-array contained bot, but no explicit tag in content. Ignoring. content="${content?.slice(
        0,
        120
      )}"`
    );
  }

  return explicit;
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

      // Handle /autobot command (now controls Schola, not legacy autobot)
      if (commandName === "autobot") {
        const action = body.data?.options?.find((o: any) => o?.name === "action")?.value || "status";
        
        const run = (async () => {
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabase = createClient(supabaseUrl, supabaseKey);

            // Get Schola settings (ps_mod_settings, not autobot_settings)
            const { data: settings, error: fetchError } = await supabase
              .from("ps_mod_settings")
              .select("*")
              .limit(1)
              .single();

            if (fetchError || !settings) {
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: "⚠️ Schola settings not found. Please configure in the admin dashboard first." }),
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
                  content: `${statusEmoji} **Schola Auto-Reply: ${statusText}**\n\n• Delay: ${settings.delay_seconds}s\n• Bot Name: ${settings.bot_name}\n\nUse \`/autobot on\` or \`/autobot off\` to toggle.` 
                }),
              });
              return;
            }

            const newEnabled = action === "on";
            
            // Update settings
            const { error: updateError } = await supabase
              .from("ps_mod_settings")
              .update({ is_enabled: newEnabled })
              .eq("id", settings.id);

            if (updateError) {
              await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: "⚠️ Failed to update Schola settings. Please try again." }),
              });
              return;
            }

            const emoji = newEnabled ? "🟢" : "🔴";
            const message = newEnabled 
              ? `${emoji} **Schola Auto-Reply is now ACTIVE!**\n\nI'll automatically respond to unanswered questions after ${settings.delay_seconds} seconds with a friendly, human-like tone.`
              : `${emoji} **Schola Auto-Reply is now INACTIVE.**\n\nI won't auto-reply to messages. Tag me with @Scholaris AI to ask questions!`;

            await fetch(`${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: message }),
            });
          } catch (e) {
            console.error("Schola command error:", e);
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

      // IMPORTANT: Scholaris must be mention-only.
      // We intentionally do NOT auto-respond to untagged questions here.
      // Untagged questions are handled by Schola (auto-reply) via `ps_mod_message`.
      return new Response(JSON.stringify({ success: true, action: "ignored_unmentioned" }), {
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
            // Avoid dividers here (they often leak into the model's output in Discord)
            .join("\n\n")
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
            // Keep this blank to avoid the model addressing other users.
            authorName: "",
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
        ? knowledgeEntries.map(e => `[${e.category.toUpperCase()}] ${e.title}:\n${e.content}`).join("\n\n")
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