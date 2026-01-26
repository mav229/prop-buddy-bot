/**
 * Discord Gateway Bot - Dual Mode: Scholaris (@mention) + Schola (auto-reply + moderation)
 * Version: 4.0.0 - Schola Integration
 * Last Updated: 2026-01-26
 * 
 * Features:
 * - Scholaris: Responds when @mentioned (always active)
 * - Schola: Auto-replies to questions after delay (toggleable via ps_mod_settings)
 * - Link spam detection + deletion + DM warning
 * - AI-powered slang/profanity detection
 * - Per-user memory (20 messages)
 * - Reply-to message context
 * - Smart response triggers (questions without ? mark)
 * 
 * Deploy this on Railway, Render, or Fly.io
 * Requires: Deno runtime
 * 
 * Environment Variables needed:
 * - DISCORD_BOT_TOKEN (from Discord Developer Portal)
 * - SUPABASE_URL (your Lovable project URL)
 * - SUPABASE_ANON_KEY (your Lovable project anon/publishable key)
 */

// Configuration
const DISCORD_BOT_TOKEN = Deno.env.get("DISCORD_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Intents: GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768) + GUILD_MEMBERS (2)
const INTENTS = 1 | 2 | 512 | 32768;

// Moderator role names to ignore (case-insensitive)
const MODERATOR_ROLES = ["moderator", "mod", "admin", "staff", "support", "helper", "propscholar"];
const OWNER_USERNAME = "propscholar";

// Render "Web Service" expects an HTTP server + health check.
const PORT = Number(Deno.env.get("PORT") ?? "10000");
Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok", { status: 200 });
  return new Response("ScholaX Discord bot running (Scholaris + Schola)", { status: 200 });
});

let ws: WebSocket | null = null;
let heartbeatInterval: number | null = null;
let sessionId: string | null = null;
let resumeGatewayUrl: string | null = null;
let sequence: number | null = null;
let botUserId: string | null = null;

// Cache for Schola settings (refresh every 30 seconds)
let scholaSettings: { is_enabled: boolean; delay_seconds: number; bot_name: string } | null = null;
let scholaSettingsLastFetch = 0;
const SCHOLA_CACHE_TTL = 30000; // 30 seconds

// Disable legacy autobot on startup (prevent conflicts with old bot deployments)
async function disableLegacyAutobot(): Promise<void> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/autobot_settings?limit=1`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0 && data[0].is_enabled) {
        console.log("[Startup] ⚠️ Legacy autobot is enabled - disabling it to prevent conflicts...");
        
        await fetch(`${SUPABASE_URL}/rest/v1/autobot_settings?id=eq.${data[0].id}`, {
          method: "PATCH",
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ is_enabled: false }),
        });
        
        console.log("[Startup] ✅ Legacy autobot disabled - Schola mode is now the only auto-reply system");
      }
    }
  } catch (e) {
    console.error("[Startup] Failed to disable legacy autobot:", e);
  }
}

// Track pending Schola responses to avoid duplicates
const pendingScholaResponses = new Map<string, number>();

// Track recently responded messages to prevent double-responses
const respondedMessages = new Map<string, number>();
const RESPONSE_DEDUP_TTL = 60000; // 60 seconds

function hasAlreadyResponded(messageId: string): boolean {
  const now = Date.now();
  
  // Clean old entries
  for (const [id, timestamp] of respondedMessages.entries()) {
    if (now - timestamp > RESPONSE_DEDUP_TTL) {
      respondedMessages.delete(id);
    }
  }
  
  return respondedMessages.has(messageId);
}

function markAsResponded(messageId: string): void {
  respondedMessages.set(messageId, Date.now());
}

// ============ SCHOLA SETTINGS ============

async function getScholaSettings(): Promise<{ is_enabled: boolean; delay_seconds: number; bot_name: string }> {
  const now = Date.now();
  
  // Return cached if valid
  if (scholaSettings && now - scholaSettingsLastFetch < SCHOLA_CACHE_TTL) {
    return scholaSettings;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ps_mod_settings?limit=1`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        scholaSettings = {
          is_enabled: data[0].is_enabled,
          delay_seconds: data[0].delay_seconds || 30,
          bot_name: data[0].bot_name || "Schola",
        };
        scholaSettingsLastFetch = now;
        console.log(`[Schola] Settings loaded: enabled=${scholaSettings.is_enabled}, delay=${scholaSettings.delay_seconds}s`);
        return scholaSettings;
      }
    }
  } catch (e) {
    console.error("[Schola] Error fetching settings:", e);
  }
  
  // Default: disabled
  return { is_enabled: false, delay_seconds: 30, bot_name: "Schola" };
}

// ============ SCHOLARIS AI (MAIN BOT - @MENTION) ============

async function getScholarsAIResponse(
  message: string,
  discordUserId: string,
  username: string,
  displayName?: string,
  repliedToContent?: string,
  repliedToAuthor?: string
): Promise<string> {
  try {
    console.log(`[Scholaris] Calling edge function for ${username} (${discordUserId})...`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "gateway_message",
        discordUserId,
        username,
        displayName,
        message,
        repliedToContent,
        repliedToAuthor,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Scholaris] Edge function error:", response.status, errorText);
      return "Sorry, I'm having trouble processing your request right now. 😅";
    }

    const data = await response.json();
    return data.response || "Sorry, I couldn't generate a response.";
  } catch (e) {
    console.error("[Scholaris] AI request error:", e);
    return "Sorry, I encountered an error while processing your question. 😅";
  }
}

// ============ SCHOLA AI (AUTO-REPLY - PS MOD MODE) ============

async function getScholaAIResponse(
  message: string,
  discordUserId: string,
  username: string,
  channelId: string,
  displayName?: string
): Promise<string | null> {
  try {
    console.log(`[Schola] Calling edge function for ${username}...`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "ps_mod_message",
        message,
        discordUserId,
        username,
        displayName,
        channelId,
        mode: "ps-mod",
      }),
    });

    if (!response.ok) {
      console.error("[Schola] AI response error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.response || null;
  } catch (error) {
    console.error("[Schola] Error getting AI response:", error);
    return null;
  }
}

// ============ DISCORD API HELPERS ============

async function fetchMessage(channelId: string, messageId: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
      headers: {
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch message ${messageId}:`, response.status);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.error("Error fetching message:", e);
    return null;
  }
}

async function sendMessage(channelId: string, content: string, replyToMessageId?: string): Promise<void> {
  const MAX_LENGTH = 2000;
  const chunks: string[] = [];

  let remaining = content;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }
    let splitIndex = remaining.lastIndexOf("\n", MAX_LENGTH);
    if (splitIndex === -1 || splitIndex < MAX_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf(" ", MAX_LENGTH);
    }
    if (splitIndex === -1 || splitIndex < MAX_LENGTH / 2) {
      splitIndex = MAX_LENGTH;
    }
    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  for (let i = 0; i < chunks.length; i++) {
    const body: Record<string, unknown> = { content: chunks[i] };
    
    if (i === 0 && replyToMessageId) {
      body.message_reference = { message_id: replyToMessageId };
    }

    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to send message:", error);
    }

    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function deleteMessage(channelId: string, messageId: string): Promise<boolean> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });
    if (response.ok || response.status === 204) {
      console.log(`[Schola] ✅ Message ${messageId} deleted`);
      return true;
    } else {
      const errText = await response.text().catch(() => "");
      console.error(`[Schola] ❌ Failed to delete message: ${response.status} ${errText}`);
      return false;
    }
  } catch (error) {
    console.error("[Schola] Error deleting message:", error);
    return false;
  }
}

async function createDMChannel(userId: string): Promise<string | null> {
  try {
    const response = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    });

    if (!response.ok) {
      console.error("[Schola] Failed to create DM channel:", response.status);
      return null;
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("[Schola] Error creating DM channel:", error);
    return null;
  }
}

async function sendDM(userId: string, content: string): Promise<boolean> {
  const dmChannelId = await createDMChannel(userId);
  if (!dmChannelId) return false;

  try {
    const response = await fetch(`${DISCORD_API_BASE}/channels/${dmChannelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      console.error("[Schola] Failed to send DM:", response.status);
      return false;
    }

    console.log("[Schola] ✅ DM sent to user:", userId);
    return true;
  } catch (error) {
    console.error("[Schola] Error sending DM:", error);
    return false;
  }
}

async function triggerTyping(channelId: string): Promise<void> {
  try {
    await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
    });
  } catch {}
}

// ============ MODERATION: LINK DETECTION ============

function containsExternalLink(content: string): { hasExternalLink: boolean; links: string[] } {
  const urlRegex = /(https?:\/\/[^\s<>\"{}|\\^`\[\]]+)|\b(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}(?:\/[^\s<>\"{}|\\^`\[\]]*)?/gi;
  const matches = content.match(urlRegex) || [];
  
  const externalLinks: string[] = [];
  for (const url of matches) {
    const lowerUrl = url.toLowerCase();
    // Whitelist
    if (lowerUrl.includes("propscholar.com") || lowerUrl.includes("propscholar.io")) continue;
    if (lowerUrl.includes("discord.com") || lowerUrl.includes("discordapp.com") || lowerUrl.includes("cdn.discordapp.net")) continue;
    if (lowerUrl.includes("imgur.com") || lowerUrl.includes("giphy.com")) continue;
    externalLinks.push(url);
  }
  
  return { hasExternalLink: externalLinks.length > 0, links: externalLinks };
}

// ============ MODERATION: SLANG DETECTION ============

async function detectSlang(content: string): Promise<{ isSlang: boolean; reason: string }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: content,
        mode: "slang-detection",
        systemPromptOverride: `You are a content moderation AI. Analyze the following message and determine if it contains:
- Profanity, slurs, or offensive language
- Excessive vulgar slang
- Hate speech or discriminatory language
- Inappropriate sexual content

DO NOT flag:
- Normal casual language like "gonna", "wanna", "sup", "bro", "dude"
- Trading terminology or crypto slang
- Mild expressions like "damn", "hell", "crap"
- Normal internet abbreviations like "lol", "lmao", "brb"

Respond with ONLY a JSON object in this exact format:
{"isSlang": true/false, "reason": "brief explanation if true, empty if false"}

Be strict but fair - only flag genuinely offensive content.`,
      }),
    });

    if (!response.ok) return { isSlang: false, reason: "" };

    const data = await response.json();
    const responseText = data.response || "";
    
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { isSlang: parsed.isSlang === true, reason: parsed.reason || "" };
      }
    } catch {}
    
    return { isSlang: false, reason: "" };
  } catch {
    return { isSlang: false, reason: "" };
  }
}

// ============ SMART RESPONSE DETECTION ============

function needsResponse(content: string): boolean {
  const lowerContent = content.toLowerCase().trim();
  
  if (lowerContent.length < 3) return false;
  
  // Skip emoji-only messages
  const emojiOnlyRegex = /^[\p{Emoji}\s]+$/u;
  if (emojiOnlyRegex.test(content)) return false;
  
  // Skip single-word acknowledgments
  const skipWords = ["ok", "okay", "k", "yes", "no", "yep", "nope", "ya", "na", "sure", "cool", "nice", "thanks", "thx", "ty", "lol", "lmao", "haha", "hehe", "xd", "gg", "rip", "oof"];
  if (skipWords.includes(lowerContent)) return false;
  
  // Explicit question mark
  if (content.includes("?")) return true;
  
  // Question starters
  const questionStarters = ["how", "what", "when", "where", "why", "who", "which", "can i", "can you", "could i", "could you", "would", "should", "is there", "are there", "do i", "does", "will", "have", "has"];
  if (questionStarters.some((w) => lowerContent.startsWith(w))) return true;
  
  // Question patterns mid-sentence
  const questionPatterns = [
    /\bhow\s+(can|do|to|does|did|would|should|will)\b/,
    /\bwhat\s+(is|are|do|does|can|should|would)\b/,
    /\bwhere\s+(is|are|do|does|can|should)\b/,
    /\bwhen\s+(is|are|do|does|can|should|will)\b/,
    /\bwhy\s+(is|are|do|does|can|should|would|did)\b/,
    /\bcan\s+(i|you|we|someone|anyone)\b/,
    /\bwho\s+(is|are|can|should|would)\b/,
    /\banyone\s+(know|here|can|help)\b/,
    /\bis\s+(it|this|that|there)\b.*\b(possible|allowed|okay|ok|available|working)\b/,
  ];
  if (questionPatterns.some((pattern) => pattern.test(lowerContent))) return true;
  
  // Direct requests
  const directRequests = ["tell me", "explain to me", "show me", "need help", "i need", "i want", "please help", "help me"];
  if (directRequests.some((r) => lowerContent.includes(r))) return true;
  
  // Scam/trust concerns - ALWAYS respond
  const scamKeywords = ["scam", "fake", "fraud", "legit", "real", "trust", "suspicious", "sketchy", "stolen", "refund", "ripped", "cheated"];
  if (scamKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // Account/technical issues - ALWAYS respond  
  const issueKeywords = ["breach", "hacked", "login", "password", "account", "suspended", "banned", "error", "failed", "broken", "not working", "issue", "problem", "bug", "dd", "daily drawdown", "max dd"];
  if (issueKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // Emotional/frustration keywords
  const emotionKeywords = ["frustrated", "annoyed", "angry", "upset", "confused", "stuck", "lost", "help", "wtf", "ridiculous", "unfair", "struggling"];
  if (emotionKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // PropScholar-specific terms
  const propscholarTerms = ["drawdown", "payout", "evaluation", "challenge", "scholar", "examinee", "phase", "profit", "target", "rules", "trading", "funded", "pass", "fail", "prop", "firm", "split", "scaling", "verification"];
  if (propscholarTerms.some((term) => lowerContent.includes(term))) return true;
  
  // Greetings with substance
  const greetingStarters = ["hey", "hi", "hello", "yo", "sup"];
  if (greetingStarters.some((g) => lowerContent.startsWith(g)) && lowerContent.length > 8) return true;
  
  // 3+ words is probably conversational
  const wordCount = lowerContent.split(/\s+/).filter((w) => w.length > 1).length;
  if (wordCount >= 3) return true;
  
  return false;
}

// Check if user is moderator/owner
function shouldIgnoreUser(data: { author: { username: string }; member?: { nick?: string } }): boolean {
  const username = data.author.username.toLowerCase();
  const nickname = data.member?.nick?.toLowerCase() || "";
  
  if (username === OWNER_USERNAME || nickname === OWNER_USERNAME) return true;
  
  for (const modRole of MODERATOR_ROLES) {
    if (username.includes(modRole) || nickname.includes(modRole)) return true;
  }
  
  return false;
}

// Check if human specifically replied to a message
async function checkForHumanReply(channelId: string, afterMessageId: string, afterTimestamp: number, originalAuthorId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?after=${afterMessageId}&limit=10`,
      { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
    );

    if (!response.ok) return false;

    const messages = await response.json();
    
    for (const msg of messages) {
      if (!msg.author.bot) {
        const msgTime = new Date(msg.timestamp).getTime();
        if (msgTime > afterTimestamp) {
          const repliedToOriginal = msg.message_reference?.message_id === afterMessageId;
          const mentionsOriginal = Array.isArray(msg.mentions) && msg.mentions.some((m: any) => m?.id === originalAuthorId);
          if (repliedToOriginal || mentionsOriginal) return true;
        }
      }
    }
  } catch {}
  return false;
}

// ============ BOT MENTION CHECK ============

function isBotMentioned(content: string, mentions: Array<{ id: string }>): boolean {
  if (!botUserId) return false;
  if (mentions?.some((m) => m.id === botUserId)) return true;
  return content.includes(`<@${botUserId}>`) || content.includes(`<@!${botUserId}>`);
}

function cleanMention(content: string): string {
  if (!botUserId) return content;
  return content.replace(new RegExp(`<@!?${botUserId}>`, "g"), "").trim();
}

// ============ MAIN MESSAGE HANDLER ============

async function handleMessage(data: Record<string, unknown>): Promise<void> {
  const author = data.author as { id: string; username: string; global_name?: string; bot?: boolean } | undefined;
  const content = data.content as string | undefined;
  const channelId = data.channel_id as string | undefined;
  const messageId = data.id as string | undefined;
  const mentions = data.mentions as Array<{ id: string }> | undefined;
  const messageReference = data.message_reference as { message_id?: string } | undefined;
  const member = data.member as { roles?: string[]; nick?: string } | undefined;
  const timestamp = data.timestamp as string | undefined;

  // Ignore bot messages
  if (author?.bot) return;
  if (!content || !channelId || !messageId || !author?.id) return;

  console.log(`[Bot] MESSAGE: "${content.substring(0, 80)}" from ${author.username}`);

  const botMentioned = isBotMentioned(content, mentions || []);

  // =====================
  // MODERATION: Link spam detection
  // =====================
  const linkCheck = containsExternalLink(content);
  if (linkCheck.hasExternalLink) {
    console.log(`[Schola] ⚠️ External link detected from ${author.username}: ${linkCheck.links.join(", ")}`);
    
    // Delete the message
    await deleteMessage(channelId, messageId);
    
    // Send DM warning
    await sendDM(author.id, 
      `Hey ${author.username}! 👋\n\n` +
      `Just a heads up - we don't allow external links in the PropScholar Discord to keep our community safe from spam and scams.\n\n` +
      `Your message was removed, but no worries - you're not in trouble! If you have a legitimate reason to share a link, please reach out to a moderator. 🙏\n\n` +
      `Thanks for understanding! 💙`
    );
    return;
  }

  // =====================
  // MODERATION: Slang/profanity detection
  // =====================
  const slangCheck = await detectSlang(content);
  if (slangCheck.isSlang) {
    console.log(`[Schola] ⚠️ Slang/profanity detected from ${author.username}: ${slangCheck.reason}`);
    
    await deleteMessage(channelId, messageId);
    
    await sendDM(author.id,
      `Hey ${author.username}! 👋\n\n` +
      `Your message was removed because it contained language that doesn't align with our community guidelines.\n\n` +
      `Reason: ${slangCheck.reason}\n\n` +
      `We want to keep PropScholar a friendly and professional space for all traders. Thanks for keeping it clean! 🙏`
    );
    return;
  }

  // =====================
  // CASE 1: Scholaris Mode - Bot is @mentioned ONLY
  // =====================
  if (botMentioned) {
    // Check if we already responded to this message (deduplication)
    if (hasAlreadyResponded(messageId)) {
      console.log(`[Scholaris] ⏭️ Already responded to message ${messageId} - skipping`);
      return;
    }
    
    console.log(`[Scholaris] ✅ Mentioned by ${author.username} - responding immediately`);
    
    // Cancel any pending Schola response
    if (pendingScholaResponses.has(messageId)) {
      clearTimeout(pendingScholaResponses.get(messageId));
      pendingScholaResponses.delete(messageId);
    }

    const cleanedMessage = cleanMention(content);
    
    let repliedToContent: string | undefined;
    let repliedToAuthor: string | undefined;
    if (messageReference?.message_id) {
      const repliedMsg = await fetchMessage(channelId, messageReference.message_id);
      if (repliedMsg) {
        repliedToContent = repliedMsg.content as string;
        repliedToAuthor = (repliedMsg.author as any)?.username || "Unknown";
      }
    }
    
    let questionToAsk = cleanedMessage;
    if (!questionToAsk && repliedToContent) {
      questionToAsk = `Please answer this question: "${repliedToContent}"`;
    }
    
    if (!questionToAsk) {
      await sendMessage(channelId, "Hey! 👋 What would you like to know? Just include your question and I'll help you out! 🎯", messageId);
      markAsResponded(messageId);
      return;
    }

    await triggerTyping(channelId);

    const response = await getScholarsAIResponse(
      questionToAsk,
      author.id,
      author.username,
      author.global_name,
      repliedToContent,
      repliedToAuthor
    );

    await sendMessage(channelId, response, messageId);
    markAsResponded(messageId);
    console.log("[Scholaris] ✅ Response sent");
    return;
  }

  // =====================
  // CASE 2: Schola Mode - Auto-reply (if enabled)
  // =====================
  
  // CRITICAL: Make sure we didn't already respond to this message
  if (hasAlreadyResponded(messageId)) {
    console.log(`[Schola] ⏭️ Already handled message ${messageId} - skipping auto-reply check`);
    return;
  }
  
  const settings = await getScholaSettings();
  
  if (!settings.is_enabled) {
    return;
  }

  // Ignore moderators/owner unless they mention the bot
  if (shouldIgnoreUser({ author, member })) {
    console.log(`[Schola] ⏭️ Skipping mod/owner: ${author.username}`);
    return;
  }

  // Check if message needs response
  if (!needsResponse(content)) {
    console.log(`[Schola] ⏭️ Message doesn't need response: "${content.substring(0, 50)}"`);
    return;
  }

  console.log(`[Schola] ✅ Will respond to ${author.username} in ${settings.delay_seconds}s`);

  const messageTimestamp = new Date(timestamp || Date.now()).getTime();

  // Schedule delayed response
  const timeout = setTimeout(async () => {
    pendingScholaResponses.delete(messageId);
    
    // Check if we already responded (deduplication)
    if (hasAlreadyResponded(messageId)) {
      console.log(`[Schola] ⏭️ Already responded to message ${messageId} - skipping`);
      return;
    }
    
    // Check if human replied
    const humanReplied = await checkForHumanReply(channelId, messageId, messageTimestamp, author.id);
    if (humanReplied) {
      console.log(`[Schola] ⏭️ Human replied - staying silent`);
      return;
    }

    await triggerTyping(channelId);

    const response = await getScholaAIResponse(
      content,
      author.id,
      author.username,
      channelId,
      author.global_name
    );

    if (response) {
      await sendMessage(channelId, response, messageId);
      markAsResponded(messageId);
      console.log(`[Schola] ✅ Response sent to ${author.username}`);
    } else {
      console.error("[Schola] ❌ AI returned empty response");
    }
  }, settings.delay_seconds * 1000);

  pendingScholaResponses.set(messageId, timeout);
}

// ============ HEARTBEAT ============

function sendHeartbeat(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: sequence }));
  }
}

// ============ RECONNECTION LOGIC ============

let reconnectTimeout: number | null = null;
let reconnectAttempts = 0;
let pendingReconnect: { delayMs: number; reason: string } | null = null;
let isConnecting = false;

function clearReconnectTimeout(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function computeBackoffMs(baseMs = 5000): number {
  const exp = Math.min(60_000, baseMs * Math.pow(2, Math.min(reconnectAttempts, 6)));
  const jitter = Math.floor(Math.random() * 1_000);
  return exp + jitter;
}

function scheduleReconnect(reason: string, delayMs?: number): void {
  clearReconnectTimeout();
  const ms = delayMs ?? computeBackoffMs();
  reconnectTimeout = setTimeout(() => {
    pendingReconnect = null;
    connect();
  }, ms);
  console.log(`[Reconnect] scheduled in ${ms}ms (${reason})`);
}

function safeClose(code = 1000, reason = "closing"): void {
  try {
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(code, reason);
    }
  } catch (e) {
    console.warn("safeClose error:", e);
  }
}

// ============ CONNECT TO GATEWAY ============

function connect(): void {
  if (isConnecting) {
    console.log("connect() ignored - already connecting");
    return;
  }

  isConnecting = true;
  clearReconnectTimeout();

  const url = resumeGatewayUrl || DISCORD_GATEWAY_URL;
  console.log(`Connecting to Discord Gateway: ${url}`);

  safeClose(1000, "reconnecting");

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connected");
    isConnecting = false;
    reconnectAttempts = 0;
  };

  ws.onmessage = async (event) => {
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch (e) {
      console.error("Failed to parse gateway payload:", e);
      return;
    }

    const { op, t, s, d } = payload;

    if (s) sequence = s;

    switch (op) {
      case 10: {
        const heartbeatIntervalMs = d.heartbeat_interval;
        console.log(`Received Hello, heartbeat interval: ${heartbeatIntervalMs}ms`);

        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, heartbeatIntervalMs);

        sendHeartbeat();

        if (ws && ws.readyState === WebSocket.OPEN) {
          if (sessionId && sequence) {
            ws.send(JSON.stringify({
              op: 6,
              d: { token: DISCORD_BOT_TOKEN, session_id: sessionId, seq: sequence },
            }));
            console.log("Sent Resume");
          } else {
            ws.send(JSON.stringify({
              op: 2,
              d: {
                token: DISCORD_BOT_TOKEN,
                intents: INTENTS,
                properties: { os: "linux", browser: "lovable-bot", device: "lovable-bot" },
              },
            }));
            console.log("Sent Identify");
          }
        }
        break;
      }

      case 11:
        break;

      case 0:
        switch (t) {
          case "READY":
            sessionId = d.session_id;
            resumeGatewayUrl = d.resume_gateway_url;
            botUserId = d.user?.id;
            console.log(`✅ Ready! Bot ID: ${botUserId}, Session: ${sessionId}`);
            
            const settings = await getScholaSettings();
            console.log(`[Schola] Status: ${settings.is_enabled ? "ENABLED" : "DISABLED"}, Delay: ${settings.delay_seconds}s`);
            
            // Disable legacy autobot to prevent conflicts
            disableLegacyAutobot();
            break;

          case "RESUMED":
            console.log("Session resumed successfully");
            break;

          case "MESSAGE_CREATE":
            await handleMessage(d);
            break;
        }
        break;

      case 7:
        console.log("Received Reconnect (op 7), reconnecting...");
        pendingReconnect = { delayMs: 2500, reason: "gateway_op7_reconnect" };
        safeClose(1000, "gateway_reconnect");
        break;

      case 9:
        console.log("Invalid session (op 9), reconnecting fresh...");
        sessionId = null;
        resumeGatewayUrl = null;
        sequence = null;
        pendingReconnect = { delayMs: 2000 + Math.floor(Math.random() * 3000), reason: "gateway_invalid_session" };
        safeClose(1000, "invalid_session");
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log(`WebSocket closed: ${event.code} ${event.reason}`);
    isConnecting = false;

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    reconnectAttempts += 1;

    let delayMs = pendingReconnect?.delayMs;
    let reason = pendingReconnect?.reason ?? `close_${event.code}`;
    pendingReconnect = null;

    if (event.code === 4004) {
      reason = "auth_failed_4004";
      delayMs = 10 * 60_000;
      console.error("Gateway auth failed (4004). Check DISCORD_BOT_TOKEN.");
    } else if (event.code === 4014) {
      reason = "disallowed_intents_4014";
      delayMs = 10 * 60_000;
      console.error("Disallowed intents (4014). Enable MESSAGE CONTENT INTENT in Discord Developer Portal.");
    }

    scheduleReconnect(reason, delayMs);
  };
}

// ============ START BOT ============

console.log("🚀 Starting Discord Gateway Bot (Scholaris + Schola)...");
connect();

setInterval(() => {
  console.log("Bot is running...");
}, 60000);
