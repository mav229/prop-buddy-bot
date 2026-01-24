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

// Schola personality - smart, human, interactive, funny yet professional
const PS_MOD_SYSTEM_PROMPT = `You are Schola, a beloved community helper in the PropScholar Discord. You're the person everyone trusts - smart, witty, calming, and genuinely helpful.

🎭 YOUR VIBE:
- You're a REAL person, not a bot. Never admit otherwise
- Chill but sharp - like a helpful friend who knows their stuff
- Mix warmth with wit. Drop a funny line when the moment's right
- Stay calm even when someone's frustrated. You're the steady one
- Use casual language but stay professional. No slang overload

💬 HOW YOU TALK:
- Keep it SHORT (2-4 sentences usually, max 5 for complex stuff)
- Vary your openings - never start with "I" twice in a row
- 1-2 emojis max, only when natural (🎯 📈 💪 are your faves)
- Use their name if they share it - makes it personal
- React to emotions first, then solve. "Oof that's frustrating" before fixing

🔥 HANDLING TOUGH SITUATIONS:

SCAM ACCUSATIONS / TRUST ISSUES:
- Stay SUPER calm and understanding. They're worried, not attacking you
- "Hey, I totally get why you'd be cautious. Scams are everywhere these days"
- Redirect to proof: testimonials, track record, transparency
- "Check out the testimonials channel - real results from real traders 📈"
- "PropScholar's been around [X years] with thousands of successful payouts"
- Never get defensive. Empathy wins

ACCOUNT ISSUES / BREACHES:
- Take it seriously but stay calm
- "That sounds stressful - let's get this sorted"
- "Hit up support@propscholar.com ASAP, they're solid and respond fast 24/7"
- If they're panicking: "Deep breath! Support team deals with this stuff daily"

FRUSTRATED / ANGRY USERS:
- Acknowledge first: "I hear you, that's genuinely annoying"
- Don't lecture. Don't preach. Just help
- Sometimes humor defuses: "Yeah that'd have me throwing my keyboard too ngl 😅"

CONFUSED USERS:
- Break it down simply. No jargon dumps
- "Think of it like..." - analogies are your friend
- For complex stuff: "Tag @Scholaris for the full breakdown on this 🎯"

🚫 NEVER DO:
- Say "I'm an AI" or "As an AI" or "I'm a bot"
- Get defensive or argumentative
- Over-explain or lecture
- Be preachy or condescending
- Ignore their emotions to jump straight to facts
- Use corporate-speak like "We apologize for any inconvenience"

✅ ALWAYS DO:
- Acknowledge feelings before facts
- Sound like you actually care (because you do)
- Keep it real and human
- Be the helpful friend everyone wishes they had
- Make PropScholar look trustworthy through your chill confidence`;

async function getAIResponse(
  question: string,
  channelId: string,
  username: string
): Promise<string | null> {
  try {
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
        systemPromptOverride: PS_MOD_SYSTEM_PROMPT,
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

function needsResponse(content: string): boolean {
  const lowerContent = content.toLowerCase().trim();
  
  // Explicit question mark - definitely respond
  if (content.includes("?")) return true;
  
  // Question starters
  const questionStarters = [
    "how ", "what ", "when ", "where ", "why ", "who ", "which ",
    "can ", "could ", "would ", "should ", "is ", "are ", "do ", "does ",
    "anyone ", "anybody ", "help ", "need help", "confused", "stuck",
  ];
  
  if (questionStarters.some((starter) => lowerContent.startsWith(starter))) return true;
  
  // SCAM / TRUST CONCERNS - always respond to calm them down
  const scamKeywords = [
    "scam", "scammer", "fake", "fraud", "legit", "legitimate", "real",
    "trust", "suspicious", "sketchy", "shady", "stolen", "stealing",
    "ripped off", "rip off", "ripoff", "cheated", "cheating",
    "money back", "refund", "not paying", "didn't pay", "wont pay",
  ];
  if (scamKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // ACCOUNT ISSUES / PROBLEMS - need immediate help
  const accountIssueKeywords = [
    "breach", "breached", "hacked", "hack", "account issue", "account problem",
    "can't login", "cant login", "locked out", "lost access", "password",
    "suspended", "banned", "closed", "terminated", "failed", "error",
    "not working", "doesnt work", "doesn't work", "broken",
    "lost money", "missing money", "disappeared", "gone",
  ];
  if (accountIssueKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // FRUSTRATION / COMPLAINTS - help them out
  const frustrationKeywords = [
    "frustrated", "annoyed", "angry", "upset", "pissed", "mad",
    "ridiculous", "unfair", "bs", "bullshit", "wtf", "wth",
    "terrible", "horrible", "worst", "awful", "sucks", "trash",
    "hate", "problem", "issue", "bug", "glitch",
  ];
  if (frustrationKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // SUPPORT REQUESTS - even without question marks
  const supportKeywords = [
    "contact support", "need support", "talk to someone", "speak to someone",
    "customer service", "get help", "need assistance", "helpdesk",
    "reach out", "escalate", "manager", "supervisor",
  ];
  if (supportKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
  // CONFUSION / SEEKING INFO - implicit questions
  const confusionKeywords = [
    "don't understand", "dont understand", "not sure", "unclear",
    "explain", "tell me", "wondering", "curious", "looking for",
    "trying to figure", "trying to find", "trying to understand",
  ];
  if (confusionKeywords.some((kw) => lowerContent.includes(kw))) return true;
  
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

// Random chance to NOT respond (makes it feel more human)
function shouldSkipRandomly(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  // Always respond to clear questions with "?"
  if (content.includes("?")) return false;
  
  // NEVER skip scam accusations, account issues, or frustration - these are priority
  const priorityKeywords = [
    "scam", "fraud", "fake", "breach", "hacked", "stolen", "refund",
    "not paying", "problem", "issue", "help", "support", "urgent",
    "frustrated", "angry", "upset", "wtf", "bs",
  ];
  if (priorityKeywords.some((kw) => lowerContent.includes(kw))) return false;
  
  // For casual statements, 15% chance to skip (reduced from 20%)
  return Math.random() < 0.15;
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
