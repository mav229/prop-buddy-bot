/**
 * PS MOD - Separate Auto-Reply Discord Bot
 * 
 * This is a completely separate bot from Scholaris.
 * It ONLY handles auto-replies to unanswered questions after a delay.
 * 
 * Deploy separately on Render with its own PS_MOD_BOT_TOKEN.
 */

const DISCORD_TOKEN = Deno.env.get("PS_MOD_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const DISCORD_API = "https://discord.com/api/v10";
const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Intents: GUILDS (1), GUILD_MESSAGES (512), MESSAGE_CONTENT (32768), GUILD_MEMBERS (2)
const INTENTS = 1 | 2 | 512 | 32768;

// Moderator role names to ignore (case-insensitive)
const MODERATOR_ROLES = ["moderator", "mod", "admin", "staff", "support", "helper", "propscholar"];

// Owner username to ignore unless they tag the bot
const OWNER_USERNAME = "propscholar";

// HTTP server for health checks
const PORT = parseInt(Deno.env.get("PORT") || "8080");

Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") {
    return new Response("OK", { status: 200 });
  }
  return new Response("PS MOD Bot Running", { status: 200 });
});

// Connection state
let ws: WebSocket | null = null;
let sessionId: string | null = null;
let seq: number | null = null;
let botUserId: string | null = null;
let heartbeatInterval: number | null = null;
let heartbeatAckReceived = true;
let reconnectAttempts = 0;

// Track pending responses to avoid duplicates
const pendingResponses = new Map<string, NodeJS.Timeout>();

// Settings cache
interface PsModSettings {
  is_enabled: boolean;
  delay_seconds: number;
  bot_name: string;
}

let settingsCache: { data: PsModSettings | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};
const SETTINGS_TTL = 30000; // 30 seconds

async function getSettings(): Promise<PsModSettings | null> {
  const now = Date.now();
  if (settingsCache.data && now - settingsCache.timestamp < SETTINGS_TTL) {
    return settingsCache.data;
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/ps_mod_settings?limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!response.ok) {
      console.error("[PS MOD] Failed to fetch settings:", response.status);
      return settingsCache.data;
    }

    const data = await response.json();
    if (data && data.length > 0) {
      settingsCache = {
        data: {
          is_enabled: data[0].is_enabled,
          delay_seconds: data[0].delay_seconds || 120,
          bot_name: data[0].bot_name || "PS MOD",
        },
        timestamp: now,
      };
      return settingsCache.data;
    }
  } catch (error) {
    console.error("[PS MOD] Error fetching settings:", error);
  }

  return settingsCache.data;
}

// Schola personality - SHORT, professional, knows when to redirect
const PS_MOD_SYSTEM_PROMPT = `You are Schola — a chill, knowledgeable community member in PropScholar's Discord.

## IDENTITY
- You're NOT a bot, you're a helpful community member who knows PropScholar
- Tone: Calm, professional, slightly witty. Almost NO emojis (rare occasions only)
- Never say "I'm an AI" or "I'm a bot"

## CRITICAL: RESPONSE LENGTH
- MAX 2-3 sentences for most replies
- Be concise and direct - no long explanations
- If a question needs a detailed/complex answer → say "That's a good one for @Scholaris - they can break it down properly for you"

## WHEN TO REDIRECT

**Redirect to @Scholaris when:**
- Question needs detailed explanation
- Complex trading strategy questions
- Multi-part questions
- Anything requiring paragraphs to explain

**Redirect to support@propscholar.com when:**
- You're not 100% sure of the answer
- Account-specific issues (payouts, verification, login problems)
- Technical bugs or platform errors
- Anything you might get wrong
- Say: "Hit up support@propscholar.com for that one - they'll sort you out"

## EXAMPLE RESPONSES

User: "How do I pass the challenge?"
You: "Stay consistent, manage risk, don't overtrade. The rules are straightforward once you get the rhythm."

User: "Can you explain the profit split and scaling plan in detail?"
You: "That's a detailed one - @Scholaris can walk you through the full breakdown."

User: "My payout is stuck, what do I do?"
You: "For payout issues, hit up support@propscholar.com directly - they'll sort you out fast."

User: "What's the best strategy for funded trading?"
You: "Big topic. @Scholaris has some solid insights on strategy if you wanna dive deep."

User: "I don't understand how the drawdown works"
You: "It's max loss from your highest balance. But for the full breakdown, @Scholaris explains it way better."

User: [Something confusing or unclear]
You: "Not totally sure on that one - shoot support@propscholar.com a message, they'll have the right answer."

## GOLDEN RULES
1. Short replies ONLY (2-3 sentences max)
2. Complex questions → @Scholaris
3. Unsure or account issues → support@propscholar.com
4. Never guess or give potentially wrong info`;

// Cache for mod interaction learning (refreshes every 5 minutes)
interface ModLearning {
  examples: Array<{ question: string; modResponse: string }>;
  lastFetched: number;
}
let modLearningCache: ModLearning = { examples: [], lastFetched: 0 };
const MOD_LEARNING_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch recent mod responses from channel to learn from
async function fetchModResponseExamples(channelId: string): Promise<string> {
  const now = Date.now();
  
  // Return cached if fresh
  if (modLearningCache.examples.length > 0 && now - modLearningCache.lastFetched < MOD_LEARNING_TTL) {
    const examples = modLearningCache.examples
      .slice(0, 5)
      .map((e) => `User asked: "${e.question.substring(0, 100)}"\nMod replied: "${e.modResponse.substring(0, 200)}"`)
      .join("\n\n");
    return examples ? `\n\nRECENT MOD RESPONSE EXAMPLES (learn from these):\n${examples}` : "";
  }

  try {
    // Fetch last 100 messages from channel (covers ~10 days of moderate activity)
    const response = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages?limit=100`,
      {
        headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
      }
    );

    if (!response.ok) return "";

    const messages = await response.json();
    const examples: Array<{ question: string; modResponse: string }> = [];
    
    // Find patterns: user message followed by mod/non-bot response
    for (let i = messages.length - 1; i > 0; i--) {
      const prevMsg = messages[i];
      const currMsg = messages[i - 1];
      
      // Skip if either is a bot
      if (prevMsg.author?.bot || currMsg.author?.bot) continue;
      
      // Check if current message author is a mod (by username patterns)
      const responderName = (currMsg.author?.username || "").toLowerCase();
      const isModResponse = MODERATOR_ROLES.some((role) => responderName.includes(role)) ||
        responderName === OWNER_USERNAME;
      
      if (isModResponse && prevMsg.content && currMsg.content) {
        examples.push({
          question: prevMsg.content,
          modResponse: currMsg.content,
        });
        
        if (examples.length >= 10) break;
      }
    }

    modLearningCache = { examples, lastFetched: now };
    
    const formatted = examples
      .slice(0, 5)
      .map((e) => `User asked: "${e.question.substring(0, 100)}"\nMod replied: "${e.modResponse.substring(0, 200)}"`)
      .join("\n\n");
    
    console.log(`[PS MOD] Learned from ${examples.length} mod responses`);
    return formatted ? `\n\nRECENT MOD RESPONSE EXAMPLES (learn from their style):\n${formatted}` : "";
  } catch (error) {
    console.error("[PS MOD] Error fetching mod examples:", error);
    return "";
  }
}


async function getAIResponse(
  question: string,
  channelId: string,
  username: string
): Promise<string | null> {
  try {
    // Fetch mod response examples to learn from
    const modLearning = await fetchModResponseExamples(channelId);
    const enhancedPrompt = PS_MOD_SYSTEM_PROMPT + modLearning;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: question,
        channelId,
        username,
        displayName: username,
        mode: "ps-mod",
        systemPromptOverride: enhancedPrompt,
      }),
    });

    if (!response.ok) {
      console.error("[PS MOD] AI response error:", response.status);
      return null;
    }

    const data = await response.json();
    return data.response || null;
  } catch (error) {
    console.error("[PS MOD] Error getting AI response:", error);
    return null;
  }
}

// Trigger typing indicator in channel
async function triggerTypingIndicator(channelId: string): Promise<void> {
  try {
    const response = await fetch(`${DISCORD_API}/channels/${channelId}/typing`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
      },
    });
    if (!response.ok) {
      console.error("[PS MOD] Failed to trigger typing:", response.status);
    } else {
      console.log("[PS MOD] Typing indicator triggered");
    }
  } catch (error) {
    console.error("[PS MOD] Error triggering typing:", error);
  }
}

async function sendMessage(channelId: string, content: string, replyTo?: string): Promise<void> {
  const chunks = content.match(/[\s\S]{1,1900}/g) || [content];

  for (let i = 0; i < chunks.length; i++) {
    const body: Record<string, unknown> = { content: chunks[i] };
    
    // Only reply to the original message on first chunk
    if (i === 0 && replyTo) {
      body.message_reference = { message_id: replyTo };
    }

    try {
      const response = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${DISCORD_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error("[PS MOD] Failed to send message:", response.status);
      }
    } catch (error) {
      console.error("[PS MOD] Error sending message:", error);
    }

    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function checkForHumanReply(
  channelId: string,
  afterMessageId: string,
  afterTimestamp: number
): Promise<boolean> {
  try {
    const response = await fetch(
      `${DISCORD_API}/channels/${channelId}/messages?after=${afterMessageId}&limit=10`,
      {
        headers: {
          Authorization: `Bot ${DISCORD_TOKEN}`,
        },
      }
    );

    if (!response.ok) return false;

    const messages = await response.json();
    
    // Check if any human replied (not a bot)
    for (const msg of messages) {
      if (!msg.author.bot) {
        const msgTime = new Date(msg.timestamp).getTime();
        if (msgTime > afterTimestamp) {
          return true; // Human replied
        }
      }
    }
  } catch (error) {
    console.error("[PS MOD] Error checking for replies:", error);
  }

  return false;
}

// ULTRA RESPONSIVE - respond to almost everything
function needsResponse(content: string): boolean {
  const lowerContent = content.toLowerCase().trim();
  
  // Skip very short messages (greetings handled separately)
  if (lowerContent.length < 3) return false;
  
  // Skip messages that are just emojis or reactions
  const emojiOnlyRegex = /^[\p{Emoji}\s]+$/u;
  if (emojiOnlyRegex.test(content)) return false;
  
  // Skip single-word greetings/acknowledgments
  const skipWords = ["ok", "okay", "k", "yes", "no", "yep", "nope", "ya", "na", "sure", "cool", "nice", "thanks", "thx", "ty", "lol", "lmao", "haha", "hehe", "xd"];
  if (skipWords.includes(lowerContent)) return false;
  
  // RESPOND TO EVERYTHING ELSE - questions, statements, complaints, anything substantive
  
  // Explicit question mark - definitely respond
  if (content.includes("?")) return true;
  
  // Question words anywhere in the message
  const questionWords = ["how", "what", "when", "where", "why", "who", "which", "can", "could", "would", "should", "is", "are", "do", "does", "will", "have", "has"];
  if (questionWords.some((w) => lowerContent.includes(w))) return true;
  
  // Direct commands/requests to Schola
  const directRequests = ["you tell", "you say", "you explain", "no you", "answer me", "help me", "tell me", "explain to me", "show me"];
  if (directRequests.some((r) => lowerContent.includes(r))) return true;
  
  // Scam/trust concerns
  const scamKeywords = ["scam", "fake", "fraud", "legit", "real", "trust", "suspicious", "sketchy", "stolen", "refund", "ripped", "cheated"];
  if (scamKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // Account/technical issues
  const issueKeywords = ["breach", "hacked", "login", "password", "account", "suspended", "banned", "error", "failed", "broken", "not working", "issue", "problem", "bug"];
  if (issueKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // Emotional/frustration keywords
  const emotionKeywords = ["frustrated", "annoyed", "angry", "upset", "confused", "stuck", "lost", "help", "wtf", "ridiculous", "unfair"];
  if (emotionKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // PropScholar-specific terms - user is likely asking about something
  const propscholarTerms = ["drawdown", "payout", "evaluation", "challenge", "scholar", "examinee", "phase", "profit", "target", "rules", "trading", "account", "funded", "pass", "fail"];
  if (propscholarTerms.some((term) => lowerContent.includes(term))) return true;
  
  // Greetings with substance (not just "hi")
  const greetingStarters = ["hey ", "hi ", "hello ", "yo "];
  if (greetingStarters.some((g) => lowerContent.startsWith(g)) && lowerContent.length > 10) return true;
  
  // If message has 4+ words, it's probably worth responding to
  const wordCount = lowerContent.split(/\s+/).filter((w) => w.length > 1).length;
  if (wordCount >= 4) return true;
  
  return false;
}

// Check if user is a moderator or owner (by role names in member object or username)
function shouldIgnoreUser(data: {
  author: { id: string; username: string; bot?: boolean };
  member?: { roles?: string[]; nick?: string };
}): boolean {
  const username = data.author.username.toLowerCase();
  const nickname = data.member?.nick?.toLowerCase() || "";
  
  // Ignore PropScholar owner
  if (username === OWNER_USERNAME || nickname === OWNER_USERNAME) {
    return true;
  }
  
  // Check if username contains moderator-like terms
  for (const modRole of MODERATOR_ROLES) {
    if (username.includes(modRole) || nickname.includes(modRole)) {
      return true;
    }
  }
  
  return false;
}

// Minimal random skip - Schola should be highly responsive
function shouldSkipRandomly(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Always respond to questions
  if (content.includes("?")) return false;
  
  // Never skip anything important
  const neverSkip = ["scam", "fraud", "help", "issue", "problem", "hacked", "refund", "support", "wtf", "you"];
  if (neverSkip.some((kw) => lowerContent.includes(kw))) return false;
  
  // Very low skip rate (5%) for ultra-responsive behavior
  return Math.random() < 0.05;
}

async function handleMessage(data: {
  id: string;
  channel_id: string;
  content: string;
  author: { id: string; username: string; bot?: boolean };
  member?: { roles?: string[]; nick?: string };
  timestamp: string;
  mentions?: Array<{ id: string }>;
}): Promise<void> {
  // Ignore bot messages
  if (data.author.bot) return;

  // Ignore moderators and owner (unless they tag the bot)
  const isMentioned = data.mentions?.some((m) => m.id === botUserId);
  if (shouldIgnoreUser(data) && !isMentioned) {
    console.log(`[PS MOD] Ignoring mod/owner: ${data.author.username}`);
    return;
  }

  // If mentioned by mod/owner, respond. Otherwise check if mentioned at all
  if (isMentioned) {
    // This is intentional - if someone tags PS MOD, respond even if mod
    console.log(`[PS MOD] Mentioned by ${data.author.username}, will respond`);
  } else {
    // Not mentioned - this is auto-reply territory, skip if it's a mod
    if (shouldIgnoreUser(data)) return;
  }

  // Get settings
  const settings = await getSettings();
  if (!settings?.is_enabled) return;

  // Check if message needs a response (question, complaint, scam accusation, etc.)
  if (!needsResponse(data.content)) return;
  
  // Random skip for human-like behavior (only for auto-replies, not mentions)
  if (!isMentioned && shouldSkipRandomly(data.content)) {
    console.log(`[PS MOD] Random skip for human feel`);
    return;
  }

  const messageKey = `${data.channel_id}-${data.id}`;
  const messageTimestamp = new Date(data.timestamp).getTime();

  console.log(`[PS MOD] Question detected from ${data.author.username}: "${data.content.substring(0, 50)}..."`);
  console.log(`[PS MOD] Scheduling response in ${settings.delay_seconds}s...`);

  // Clear any existing pending response for this message
  if (pendingResponses.has(messageKey)) {
    clearTimeout(pendingResponses.get(messageKey)!);
  }

  // Schedule delayed response
  const timeout = setTimeout(async () => {
    pendingResponses.delete(messageKey);

    // Check if human replied during the delay
    const humanReplied = await checkForHumanReply(data.channel_id, data.id, messageTimestamp);
    
    if (humanReplied) {
      console.log(`[PS MOD] Human replied, skipping auto-response`);
      return;
    }

    // Trigger typing indicator so user sees "Schola is typing..."
    await triggerTypingIndicator(data.channel_id);

    // Get AI response
    const response = await getAIResponse(data.content, data.channel_id, data.author.username);
    
    if (response) {
      await sendMessage(data.channel_id, response, data.id);
      console.log(`[PS MOD] Responded to ${data.author.username}`);
    }
  }, settings.delay_seconds * 1000);

  pendingResponses.set(messageKey, timeout);
}

function sendHeartbeat(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: seq }));
    heartbeatAckReceived = false;
  }
}

function safeClose(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.close(1000, "Reconnecting");
    } catch (e) {
      console.error("[PS MOD] Error closing WebSocket:", e);
    }
  }
  ws = null;
}

function scheduleReconnect(): void {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts) + Math.random() * 1000, 30000);
  reconnectAttempts++;
  console.log(`[PS MOD] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})...`);
  setTimeout(connect, delay);
}

async function connect(): Promise<void> {
  if (!DISCORD_TOKEN) {
    console.error("[PS MOD] PS_MOD_BOT_TOKEN not set!");
    return;
  }

  console.log("[PS MOD] Connecting to Discord Gateway...");

  try {
    // Fetch bot user ID
    const meResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bot ${DISCORD_TOKEN}` },
    });

    if (meResponse.ok) {
      const me = await meResponse.json();
      botUserId = me.id;
      console.log(`[PS MOD] Bot identity: ${me.username}#${me.discriminator} (${botUserId})`);
    }
  } catch (e) {
    console.error("[PS MOD] Failed to fetch bot identity:", e);
  }

  ws = new WebSocket(GATEWAY_URL);

  ws.onopen = () => {
    console.log("[PS MOD] WebSocket connected");
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    const { op, t, s, d } = payload;

    if (s) seq = s;

    switch (op) {
      case 10: // Hello
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, d.heartbeat_interval);
        heartbeatAckReceived = true;

        if (sessionId && seq) {
          // Resume
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              op: 6,
              d: { token: DISCORD_TOKEN, session_id: sessionId, seq },
            }));
          }
        } else {
          // Identify
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              op: 2,
              d: {
                token: DISCORD_TOKEN,
                intents: INTENTS,
                properties: { os: "linux", browser: "ps-mod", device: "ps-mod" },
              },
            }));
          }
        }
        break;

      case 11: // Heartbeat ACK
        heartbeatAckReceived = true;
        break;

      case 7: // Reconnect
        console.log("[PS MOD] Gateway requested reconnect");
        safeClose();
        scheduleReconnect();
        break;

      case 9: // Invalid Session
        console.log("[PS MOD] Invalid session, resetting...");
        sessionId = null;
        seq = null;
        safeClose();
        setTimeout(connect, 1000 + Math.random() * 4000);
        break;

      case 0: // Dispatch
        if (t === "READY") {
          sessionId = d.session_id;
          botUserId = d.user.id;
          console.log(`[PS MOD] Ready! Session: ${sessionId}`);
        } else if (t === "RESUMED") {
          console.log("[PS MOD] Session resumed");
        } else if (t === "MESSAGE_CREATE") {
          handleMessage(d);
        }
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("[PS MOD] WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log(`[PS MOD] WebSocket closed: ${event.code} ${event.reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    // Don't reconnect on auth failures
    if (event.code === 4004) {
      console.error("[PS MOD] Invalid token! Please check PS_MOD_BOT_TOKEN.");
      return;
    }

    scheduleReconnect();
  };
}

// Start the bot
console.log("[PS MOD] Starting PS MOD Bot...");
connect();

// Keep alive
setInterval(() => {
  console.log(`[PS MOD] Heartbeat - Pending responses: ${pendingResponses.size}`);
}, 60000);
