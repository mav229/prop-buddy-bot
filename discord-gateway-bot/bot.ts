/**
 * Discord Gateway Bot - Dual Mode: Scholaris (@mention) + Autobot (auto-reply)
 * Version: 3.0.0 - Autobot Integration
 * Last Updated: 2025-01-24
 * 
 * Features:
 * - Scholaris: Responds when @mentioned (always active)
 * - Autobot: Auto-replies to all messages after delay (toggleable)
 * - Per-user memory (20 messages)
 * - Reply-to message context
 * - Professional human tone for autobot
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

// Intents: GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)
const INTENTS = 1 | 512 | 32768;

// Render "Web Service" expects an HTTP server + health check.
const PORT = Number(Deno.env.get("PORT") ?? "10000");
Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok", { status: 200 });
  return new Response("ScholaX Discord bot running (Dual Mode)", { status: 200 });
});

let ws: WebSocket | null = null;
let heartbeatInterval: number | null = null;
let sessionId: string | null = null;
let resumeGatewayUrl: string | null = null;
let sequence: number | null = null;
let botUserId: string | null = null;

// Cache for autobot settings (refresh every 30 seconds)
let autobotSettings: { is_enabled: boolean; delay_seconds: number; bot_name: string } | null = null;
let autobotSettingsLastFetch = 0;
const AUTOBOT_CACHE_TTL = 30000; // 30 seconds

// Track pending autobot responses to avoid duplicates
const pendingAutobotResponses = new Map<string, NodeJS.Timeout>();

// Fetch autobot settings from Supabase
async function getAutobotSettings(): Promise<{ is_enabled: boolean; delay_seconds: number; bot_name: string }> {
  const now = Date.now();
  
  // Return cached if valid
  if (autobotSettings && now - autobotSettingsLastFetch < AUTOBOT_CACHE_TTL) {
    return autobotSettings;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/autobot_settings?limit=1`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        autobotSettings = {
          is_enabled: data[0].is_enabled,
          delay_seconds: data[0].delay_seconds || 120,
          bot_name: data[0].bot_name || "PropScholar Assistant",
        };
        autobotSettingsLastFetch = now;
        return autobotSettings;
      }
    }
  } catch (e) {
    console.error("Error fetching autobot settings:", e);
  }
  
  // Default: disabled
  return { is_enabled: false, delay_seconds: 120, bot_name: "PropScholar Assistant" };
}

// Get AI response for Scholaris (main bot, @mention mode)
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

// Get AI response for Autobot (auto-reply mode) - professional human tone
async function getAutobotAIResponse(
  message: string,
  discordUserId: string,
  username: string,
  displayName?: string,
  repliedToContent?: string,
  repliedToAuthor?: string
): Promise<string> {
  try {
    console.log(`[Autobot] Calling edge function for ${username} (${discordUserId})...`);

    const response = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "autobot_message",
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
      console.error("[Autobot] Edge function error:", response.status, errorText);
      return "I noticed your question! Let me help - though if you need more details, feel free to tag our team.";
    }

    const data = await response.json();
    return data.response || "I'm here to help! Could you provide a bit more detail about what you're looking for?";
  } catch (e) {
    console.error("[Autobot] AI request error:", e);
    return "I noticed your question! Let me try to help - please give me a moment.";
  }
}

// Fetch a specific message by ID (for replied-to messages)
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

// Check if any human replied to a message after it was sent
async function checkForHumanReply(channelId: string, afterMessageId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages?after=${afterMessageId}&limit=20`,
      {
        headers: {
          "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    if (!response.ok) return false;
    
    const messages = await response.json();
    // Check if any non-bot user replied
    return messages.some((msg: any) => !msg.author?.bot);
  } catch (e) {
    console.error("Error checking for human reply:", e);
    return false;
  }
}

// Send message to Discord channel
async function sendMessage(channelId: string, content: string, replyToMessageId?: string): Promise<void> {
  const MAX_LENGTH = 2000;
  const chunks: string[] = [];

  // Split message if too long
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
    
    // Only reply to the first chunk
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

    // Small delay between chunks
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// Check if bot is mentioned in the message
function isBotMentioned(content: string, mentions: Array<{ id: string }>): boolean {
  if (!botUserId) return false;
  
  // Check mentions array
  if (mentions?.some((m) => m.id === botUserId)) {
    return true;
  }
  
  // Check content for <@BOT_ID> pattern
  return content.includes(`<@${botUserId}>`) || content.includes(`<@!${botUserId}>`);
}

// Clean the mention from the message
function cleanMention(content: string): string {
  if (!botUserId) return content;
  return content
    .replace(new RegExp(`<@!?${botUserId}>`, "g"), "")
    .trim();
}

// Check if message looks like a question
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

// Handle incoming message
async function handleMessage(data: Record<string, unknown>): Promise<void> {
  const author = data.author as { id: string; username?: string; global_name?: string; bot?: boolean } | undefined;
  const content = data.content as string | undefined;
  const channelId = data.channel_id as string | undefined;
  const messageId = data.id as string | undefined;
  const mentions = data.mentions as Array<{ id: string }> | undefined;
  const messageReference = data.message_reference as { message_id?: string } | undefined;

  // Ignore bot messages
  if (author?.bot) return;

  if (!content || !channelId || !messageId || !author?.id) return;

  const botMentioned = isBotMentioned(content, mentions || []);

  // =====================
  // CASE 1: Scholaris Mode - Bot is @mentioned
  // =====================
  if (botMentioned) {
    console.log(`[Scholaris] Bot mentioned by ${author.username} (${author.id}) in channel ${channelId}`);
    
    // Cancel any pending autobot response for this message
    if (pendingAutobotResponses.has(messageId)) {
      clearTimeout(pendingAutobotResponses.get(messageId));
      pendingAutobotResponses.delete(messageId);
    }

    // Clean the message (remove mention)
    const cleanedMessage = cleanMention(content);
    
    // Fetch replied-to message if this is a reply
    let repliedToContent: string | undefined;
    let repliedToAuthor: string | undefined;
    if (messageReference?.message_id) {
      console.log(`Message is a reply to: ${messageReference.message_id}`);
      const repliedMsg = await fetchMessage(channelId, messageReference.message_id);
      if (repliedMsg) {
        repliedToContent = repliedMsg.content as string;
        const repliedAuthorObj = repliedMsg.author as { username?: string } | undefined;
        repliedToAuthor = repliedAuthorObj?.username || "Unknown User";
      }
    }
    
    // If user just mentioned bot with no text but replied to a message, use that as the question
    let questionToAsk = cleanedMessage;
    if (!questionToAsk && repliedToContent) {
      questionToAsk = `Please answer this question: "${repliedToContent}"`;
    }
    
    if (!questionToAsk) {
      await sendMessage(channelId, "Hey! 👋 What would you like to know? Just include your question and I'll help you out! 🎯", messageId);
      return;
    }

    // Show typing indicator
    await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
    });

    // Get AI response via Scholaris edge function
    const response = await getScholarsAIResponse(
      questionToAsk,
      author.id,
      author.username || "User",
      author.global_name,
      repliedToContent,
      repliedToAuthor
    );

    await sendMessage(channelId, response, messageId);
    console.log("[Scholaris] Response sent successfully");
    return;
  }

  // =====================
  // CASE 2: Autobot Mode - Auto-reply to questions (if enabled)
  // =====================
  const settings = await getAutobotSettings();
  
  if (!settings.is_enabled) {
    // Autobot disabled, ignore non-mention messages
    return;
  }

  // Only respond to messages that look like questions
  if (!isQuestion(content)) {
    return;
  }

  console.log(`[Autobot] Question detected from ${author.username}, waiting ${settings.delay_seconds}s before responding...`);

  // Schedule delayed response
  const timeout = setTimeout(async () => {
    pendingAutobotResponses.delete(messageId);
    
    // Check if someone (human) already replied
    const humanReplied = await checkForHumanReply(channelId, messageId);
    if (humanReplied) {
      console.log(`[Autobot] Human replied during wait - staying silent`);
      return;
    }

    // Fetch replied-to context if applicable
    let repliedToContent: string | undefined;
    let repliedToAuthor: string | undefined;
    if (messageReference?.message_id) {
      const repliedMsg = await fetchMessage(channelId, messageReference.message_id);
      if (repliedMsg) {
        repliedToContent = repliedMsg.content as string;
        const repliedAuthorObj = repliedMsg.author as { username?: string } | undefined;
        repliedToAuthor = repliedAuthorObj?.username || "Unknown User";
      }
    }

    // Show typing indicator
    await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
    });

    // Get AI response via Autobot edge function
    const response = await getAutobotAIResponse(
      content,
      author.id,
      author.username || "User",
      author.global_name,
      repliedToContent,
      repliedToAuthor
    );

    await sendMessage(channelId, response, messageId);
    console.log("[Autobot] Response sent successfully");
  }, settings.delay_seconds * 1000);

  pendingAutobotResponses.set(messageId, timeout);
}

// Send heartbeat
function sendHeartbeat(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: sequence }));
  }
}

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

// Connect to Discord Gateway
function connect(): void {
  if (isConnecting) {
    console.log("connect() ignored - already connecting");
    return;
  }

  isConnecting = true;
  clearReconnectTimeout();

  const url = resumeGatewayUrl || DISCORD_GATEWAY_URL;
  console.log(`Connecting to Discord Gateway: ${url}`);

  // Ensure we never keep multiple sockets around
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

    // Update sequence number
    if (s) sequence = s;

    switch (op) {
      case 10: { // Hello
        const heartbeatIntervalMs = d.heartbeat_interval;
        console.log(`Received Hello, heartbeat interval: ${heartbeatIntervalMs}ms`);

        // Start heartbeat
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, heartbeatIntervalMs);

        // Send initial heartbeat
        sendHeartbeat();

        // Identify or Resume
        if (ws && ws.readyState === WebSocket.OPEN) {
          if (sessionId && sequence) {
            ws.send(JSON.stringify({
              op: 6,
              d: {
                token: DISCORD_BOT_TOKEN,
                session_id: sessionId,
                seq: sequence,
              },
            }));
            console.log("Sent Resume");
          } else {
            ws.send(JSON.stringify({
              op: 2,
              d: {
                token: DISCORD_BOT_TOKEN,
                intents: INTENTS,
                properties: {
                  os: "linux",
                  browser: "lovable-bot",
                  device: "lovable-bot",
                },
              },
            }));
            console.log("Sent Identify");
          }
        } else {
          console.warn("WebSocket not OPEN when trying to identify/resume");
        }
        break;
      }

      case 11: // Heartbeat ACK
        break;

      case 0: // Dispatch
        switch (t) {
          case "READY":
            sessionId = d.session_id;
            resumeGatewayUrl = d.resume_gateway_url;
            botUserId = d.user?.id;
            console.log(`Ready! Bot user ID: ${botUserId}, Session: ${sessionId}`);
            
            // Fetch autobot settings on startup
            const settings = await getAutobotSettings();
            console.log(`[Autobot] Status: ${settings.is_enabled ? "ENABLED" : "DISABLED"}, Delay: ${settings.delay_seconds}s`);
            break;

          case "RESUMED":
            console.log("Session resumed successfully");
            break;

          case "MESSAGE_CREATE":
            await handleMessage(d);
            break;
        }
        break;

      case 7: // Reconnect
        console.log("Received Reconnect (op 7), reconnecting...");
        pendingReconnect = { delayMs: 2500, reason: "gateway_op7_reconnect" };
        safeClose(1000, "gateway_reconnect");
        break;

      case 9: { // Invalid Session
        console.log("Invalid session (op 9), reconnecting fresh...");
        sessionId = null;
        resumeGatewayUrl = null;
        sequence = null;

        pendingReconnect = {
          delayMs: 2000 + Math.floor(Math.random() * 3000),
          reason: "gateway_invalid_session",
        };
        safeClose(1000, "invalid_session");
        break;
      }
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

    // Fatal / configuration errors
    if (event.code === 4004) {
      reason = "auth_failed_4004";
      delayMs = 10 * 60_000;
      console.error("Gateway auth failed (4004). Check that DISCORD_BOT_TOKEN is valid.");
    } else if (event.code === 4014) {
      reason = "disallowed_intents_4014";
      delayMs = 10 * 60_000;
      console.error(
        "Gateway disallowed intents (4014). Enable MESSAGE CONTENT INTENT in the Discord Developer Portal."
      );
    }

    scheduleReconnect(reason, delayMs);
  };
}


// Start the bot
console.log("Starting Discord Gateway Bot (Dual Mode: Scholaris + Autobot)...");
connect();

// Keep the process alive
setInterval(() => {
  console.log("Bot is running...");
}, 60000);
