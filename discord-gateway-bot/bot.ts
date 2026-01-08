/**
 * Discord Gateway Bot - Responds only when @mentioned
 * Version: 2.1.0 - Memory & Personality Update
 * Last Updated: 2025-12-29
 * 
 * Features:
 * - Per-user memory (20 messages)
 * - Reply-to message context
 * - Friendly, professional personality
 * 
 * Deploy this on Railway, Render, or Fly.io
 * Requires: Deno runtime
 * 
 * Environment Variables needed:
 * - DISCORD_BOT_TOKEN (from Discord Developer Portal)
 * - SUPABASE_URL (your Lovable project URL, e.g. https://pcvkjrxrlibhyyxldbzs.supabase.co)
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

// Render “Web Service” expects an HTTP server + health check.
// This keeps deployments stable even though the bot itself uses WebSockets.
const PORT = Number(Deno.env.get("PORT") ?? "10000");
Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok", { status: 200 });
  return new Response("ScholaX Discord bot running", { status: 200 });
});

let ws: WebSocket | null = null;
let heartbeatInterval: number | null = null;
let heartbeatIntervalMs: number | null = null;
let sessionId: string | null = null;
let resumeGatewayUrl: string | null = null;
let sequence: number | null = null;
let botUserId: string | null = null;

let reconnectTimer: number | null = null;
let reconnectAttempt = 0;
let lastHeartbeatAckAt = Date.now();

const BASE_RECONNECT_DELAY_MS = 2_000;
const MAX_RECONNECT_DELAY_MS = 60_000;

let botIdentityInitPromise: Promise<void> | null = null;

async function ensureBotIdentity(): Promise<void> {
  if (botUserId) return;
  if (!botIdentityInitPromise) {
    botIdentityInitPromise = (async () => {
      try {
        const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
          headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
        });
        if (!res.ok) {
          console.error("Failed to fetch bot identity:", res.status, await res.text());
          return;
        }
        const me = await res.json();
        botUserId = typeof me?.id === "string" ? me.id : null;
        console.log(
          botUserId
            ? `Fetched bot identity via REST: ${me?.username ?? "unknown"} (${botUserId})`
            : "Fetched bot identity via REST but missing id"
        );
      } catch (e) {
        console.error("Error fetching bot identity:", e);
      }
    })();
  }

  await botIdentityInitPromise;
}


function clearHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  heartbeatIntervalMs = null;
}

function safeCloseWs(reason: string) {
  try {
    if (!ws) return;
    if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) return;
    console.log(`Closing WebSocket (${reason})...`);
    ws.close();
  } catch (e) {
    console.error("safeCloseWs error:", e);
  }
}

function safeWsSend(payload: unknown) {
  try {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error("WebSocket send error:", e);
    return false;
  }
}

function scheduleReconnect(reason: string, delayMs?: number) {
  // Debounce reconnect attempts (prevents multiple concurrent connect() loops)
  if (reconnectTimer) return;

  const computedDelay = Math.min(
    MAX_RECONNECT_DELAY_MS,
    Math.round(BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt))
  );
  const jitter = Math.floor(Math.random() * 500);
  const finalDelay = (delayMs ?? computedDelay) + jitter;

  reconnectAttempt = Math.min(reconnectAttempt + 1, 10);

  console.log(`Scheduling reconnect in ${finalDelay}ms (${reason})`);
  clearHeartbeat();
  safeCloseWs(reason);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, finalDelay);
}

// Get AI response by calling the discord-bot edge function
async function getAIResponse(
  message: string,
  discordUserId: string,
  username: string,
  displayName?: string,
  repliedToContent?: string,
  repliedToAuthor?: string
): Promise<string> {
  try {
    console.log(
      `Calling discord-bot edge function for user ${username} (${discordUserId})...`
    );

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
      console.error("discord-bot function error:", response.status, errorText);
      return "Sorry, I'm having trouble processing your request right now.";
    }

    const data = await response.json();
    return data.response || "Sorry, I couldn't generate a response.";
  } catch (e) {
    console.error("AI request error:", e);
    return "Sorry, I encountered an error while processing your question.";
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

  // Ensure we know our own bot user ID (needed for mention detection)
  await ensureBotIdentity();
  if (!botUserId) return;

  // We require channel/message/user to reply, but content can be missing if MESSAGE CONTENT INTENT isn't available.
  if (!channelId || !messageId || !author?.id) return;

  // Some deployments/users report MESSAGE_CREATE events where `content` is empty/undefined.
  // In that case, fetch the message via REST so we can still detect mentions and read the text.
  let effectiveContent = typeof content === "string" ? content : "";
  let effectiveMentions = mentions ?? [];

  if (!effectiveContent) {
    const fetched = await fetchMessage(channelId, messageId);
    if (fetched) {
      effectiveContent = (fetched.content as string) ?? "";
      effectiveMentions = (fetched.mentions as Array<{ id: string }> | undefined) ?? effectiveMentions;
    }
  }

  if (!isBotMentioned(effectiveContent, effectiveMentions)) return;

  console.log(
    `Bot mentioned by ${author.username ?? "unknown"} (${author.id}) in channel ${channelId}`
  );

  // Clean the message (remove mention)
  const cleanedMessage = cleanMention(effectiveContent);

  // Fetch replied-to message if this is a reply
  let repliedToContent: string | undefined;
  let repliedToAuthor: string | undefined;
  if (messageReference?.message_id) {
    console.log(`Message is a reply to: ${messageReference.message_id}`);
    const repliedMsg = await fetchMessage(channelId, messageReference.message_id);
    if (repliedMsg) {
      repliedToContent = repliedMsg.content as string;
      const repliedAuthor = repliedMsg.author as { username?: string } | undefined;
      repliedToAuthor = repliedAuthor?.username || "Unknown User";
      console.log(`Replied-to message: "${repliedToContent}" by ${repliedToAuthor}`);
    }
  }

  // If user just mentioned bot with no text but replied to a message, use that as the question
  let questionToAsk = cleanedMessage;
  if (!questionToAsk && repliedToContent) {
    console.log(
      `User just tagged bot - using replied message as question: "${repliedToContent}"`
    );
    questionToAsk = `Please answer this question: "${repliedToContent}"`;
  }

  if (!questionToAsk) {
    await sendMessage(
      channelId,
      "Hey! What would you like to know? Just include your question and I'll help you out!",
      messageId
    );
    return;
  }

  // Show typing indicator
  try {
    await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
    });
  } catch (e) {
    console.error("Typing indicator error:", e);
  }

  // Get AI response via edge function with user context
  const response = await getAIResponse(
    questionToAsk,
    author.id,
    author.username || "User",
    author.global_name,
    repliedToContent,
    repliedToAuthor
  );

  // Send response
  await sendMessage(channelId, response, messageId);
  console.log("Response sent successfully");
}

// Send heartbeat
function sendHeartbeat(): void {
  const now = Date.now();

  // If ACKs stop arriving, the socket is usually wedged; reconnect.
  if (heartbeatIntervalMs) {
    const staleAfter = heartbeatIntervalMs * 2 + 10_000;
    if (now - lastHeartbeatAckAt > staleAfter) {
      console.error(
        `Heartbeat appears stalled (last ACK ${now - lastHeartbeatAckAt}ms ago). Reconnecting...`
      );
      scheduleReconnect("heartbeat_stalled", 1_000);
      return;
    }
  }

  if (!safeWsSend({ op: 1, d: sequence })) {
    console.log("Heartbeat skipped (socket not open)");
  } else {
    console.log("Heartbeat sent");
  }
}

// Connect to Discord Gateway
function connect(): void {
  // Prevent multiple concurrent connections
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.log("connect() called but socket is already OPEN/CONNECTING; skipping.");
    return;
  }

  const url = resumeGatewayUrl || DISCORD_GATEWAY_URL;
  console.log(`Connecting to Discord Gateway: ${url}`);

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connected");
    // Connection came back; reset backoff
    reconnectAttempt = 0;
    lastHeartbeatAckAt = Date.now();
  };

  ws.onmessage = async (event) => {
    try {
      const payload = JSON.parse(event.data);
      const { op, t, s, d } = payload;

      // Update sequence number
      if (typeof s === "number") sequence = s;

      switch (op) {
        case 10: {
          // Hello
          const interval = d?.heartbeat_interval;
          if (typeof interval !== "number") {
            console.error("Invalid HELLO payload (missing heartbeat_interval)");
            scheduleReconnect("invalid_hello", 2_000);
            return;
          }

          heartbeatIntervalMs = interval;
          console.log(`Received Hello, heartbeat interval: ${heartbeatIntervalMs}ms`);

          // Start heartbeat
          clearHeartbeat();
          heartbeatInterval = setInterval(sendHeartbeat, heartbeatIntervalMs);

          // Send initial heartbeat
          sendHeartbeat();

          // Identify or Resume
          const canResume = !!sessionId && typeof sequence === "number" && sequence !== null;
          if (canResume) {
            const ok = safeWsSend({
              op: 6,
              d: {
                token: DISCORD_BOT_TOKEN,
                session_id: sessionId,
                seq: sequence,
              },
            });
            console.log(ok ? "Sent Resume" : "Resume skipped (socket not open)");
          } else {
            const ok = safeWsSend({
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
            });
            console.log(ok ? "Sent Identify" : "Identify skipped (socket not open)");
          }
          break;
        }

        case 11:
          // Heartbeat ACK
          lastHeartbeatAckAt = Date.now();
          console.log("Heartbeat ACK received");
          break;

        case 0:
          // Dispatch
          switch (t) {
            case "READY":
              sessionId = d?.session_id ?? null;
              resumeGatewayUrl = d?.resume_gateway_url ?? null;
              botUserId = d?.user?.id ?? null;
              console.log(`Ready! Bot user ID: ${botUserId}, Session: ${sessionId}`);
              reconnectAttempt = 0;
              lastHeartbeatAckAt = Date.now();
              break;

            case "RESUMED":
              console.log("Session resumed successfully");
              reconnectAttempt = 0;
              lastHeartbeatAckAt = Date.now();
              break;

            case "MESSAGE_CREATE": {
              const channelId = typeof d?.channel_id === "string" ? d.channel_id : "unknown";
              const authorName = d?.author?.username ?? d?.author?.global_name ?? "unknown";
              const contentLen = typeof d?.content === "string" ? d.content.length : 0;
              const mentionsLen = Array.isArray(d?.mentions) ? d.mentions.length : 0;
              console.log(
                `[DISPATCH] MESSAGE_CREATE channel=${channelId} author=${authorName} content_len=${contentLen} mentions=${mentionsLen}`
              );
              await handleMessage(d);
              break;
            }
          }
          break;

        case 7:
          // Reconnect
          console.log("Received Reconnect opcode, reconnecting...");
          scheduleReconnect("opcode_7", 1_000);
          break;

        case 9:
          // Invalid Session
          console.log("Invalid session, reconnecting fresh...");
          sessionId = null;
          resumeGatewayUrl = null;
          sequence = null;
          scheduleReconnect("invalid_session", 5_000);
          break;
      }
    } catch (e) {
      console.error("Gateway message handling error:", e);
      scheduleReconnect("gateway_message_error", 2_000);
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    scheduleReconnect("ws_error", 2_000);
  };

  ws.onclose = (event) => {
    console.log(`WebSocket closed: ${event.code} ${event.reason}`);
    clearHeartbeat();
    scheduleReconnect(`ws_close_${event.code}`, 5_000);
  };
}

addEventListener("unhandledrejection", (ev) => {
  console.error("Unhandled promise rejection:", ev.reason);
  scheduleReconnect("unhandledrejection", 2_000);
});

addEventListener("error", (ev) => {
  console.error("Uncaught error:", (ev as ErrorEvent).error ?? ev);
  scheduleReconnect("uncaught_error", 2_000);
});

// Start the bot
(async () => {
  console.log("Starting Discord Gateway Bot (@mention only)...");
  await ensureBotIdentity();
  connect();
})();

// Keep the process alive
setInterval(() => {
  console.log("Bot is running...");
}, 60000);
