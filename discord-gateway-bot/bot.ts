/**
 * Discord Gateway Bot - Scholaris Only (Mention-Only)
 *
 * Responds ONLY when explicitly @mentioned.
 * Calls the backend discord-bot function (action: gateway_message).
 *
 * Required env vars:
 * - DISCORD_BOT_TOKEN
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 */

function requireEnv(key: string): string {
  const val = Deno.env.get(key);
  if (!val) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    // Exiting here makes Railway fail-fast instead of “running but offline”.
    Deno.exit(1);
  }
  return val;
}

const DISCORD_BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("SUPABASE_ANON_KEY");

const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// Intents: GUILDS (1) + GUILD_MESSAGES (512) + MESSAGE_CONTENT (32768)
const INTENTS = 1 | 512 | 32768;

// Health endpoint for Railway/Render
const PORT = Number(Deno.env.get("PORT") ?? "10000");
Deno.serve({ port: PORT }, (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/healthz") return new Response("ok", { status: 200 });
  return new Response("Scholaris Discord bot running", { status: 200 });
});

let ws: WebSocket | null = null;
let heartbeatInterval: number | null = null;
let sessionId: string | null = null;
let resumeGatewayUrl: string | null = null;
let sequence: number | null = null;
let botUserId: string | null = null;

async function fetchBotIdentity(): Promise<void> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/users/@me`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error(`[FATAL] Discord token is invalid or lacks access: ${res.status} ${t}`);
      // 401/403 usually means wrong token; no point retrying in a tight loop.
      Deno.exit(1);
    }

    const me = await res.json().catch(() => null);
    const id = me?.id as string | undefined;
    const username = (me?.username as string | undefined) ?? "unknown";
    if (id) {
      botUserId = id;
      console.log(`[Startup] Discord bot identity: ${username} (${id})`);
    } else {
      console.warn("[Startup] Could not parse bot user id from /users/@me response");
    }
  } catch (e) {
    console.error("[Startup] Failed to fetch Discord bot identity:", e);
    // Don’t exit here—gateway may still work and deliver READY.
  }
}

// Dedup responses (prevents double replies on reconnect/duplicate events)
const respondedMessages = new Map<string, number>();
const RESPONSE_DEDUP_TTL_MS = 60_000;

function hasAlreadyResponded(messageId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of respondedMessages.entries()) {
    if (now - ts > RESPONSE_DEDUP_TTL_MS) respondedMessages.delete(id);
  }
  return respondedMessages.has(messageId);
}

function markAsResponded(messageId: string): void {
  respondedMessages.set(messageId, Date.now());
}

function isExplicitBotMention(content: string): boolean {
  if (!botUserId) return false;
  return content.includes(`<@${botUserId}>`) || content.includes(`<@!${botUserId}>`);
}

function stripBotMention(content: string): string {
  if (!botUserId) return content.trim();
  return content.replace(new RegExp(`<@!?${botUserId}>`, "g"), "").trim();
}

async function fetchMessage(channelId: string, messageId: string): Promise<any | null> {
  try {
    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function triggerTyping(channelId: string): Promise<void> {
  try {
    await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
      method: "POST",
      headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` },
    });
  } catch {
    // ignore
  }
}

function splitDiscordMessage(content: string, max = 2000): string[] {
  const chunks: string[] = [];
  let remaining = content.trim();
  if (!remaining) return ["(empty response)"];

  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n", max);
    if (splitIndex === -1 || splitIndex < max / 2) splitIndex = remaining.lastIndexOf(" ", max);
    if (splitIndex === -1 || splitIndex < max / 2) splitIndex = max;

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trim();
  }
  return chunks;
}

async function sendMessage(channelId: string, content: string, replyToMessageId?: string): Promise<void> {
  const chunks = splitDiscordMessage(content, 2000);

  for (let i = 0; i < chunks.length; i++) {
    const body: Record<string, unknown> = { content: chunks[i] };
    if (i === 0 && replyToMessageId) body.message_reference = { message_id: replyToMessageId };

    const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Failed to send message:", res.status, t);
    }

    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 400));
  }
}

async function getScholarisResponse(input: {
  message: string;
  discordUserId: string;
  username: string;
  displayName?: string;
  repliedToContent?: string;
  repliedToAuthor?: string;
}): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/discord-bot`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "gateway_message",
        discordUserId: input.discordUserId,
        username: input.username,
        displayName: input.displayName,
        message: input.message,
        repliedToContent: input.repliedToContent,
        repliedToAuthor: input.repliedToAuthor,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("Backend error:", res.status, t);
      return "I couldn't process that right now. Please try again.";
    }

    const data = await res.json().catch(() => ({}));
    return data?.response || "I couldn't generate a response.";
  } catch (e) {
    console.error("Backend request failed:", e);
    return "I couldn't process that right now. Please try again.";
  }
}

async function handleMessage(eventData: any): Promise<void> {
  const author = eventData?.author as { id: string; username: string; global_name?: string; bot?: boolean } | undefined;
  const channelId = eventData?.channel_id as string | undefined;
  const messageId = eventData?.id as string | undefined;
  const messageReference = eventData?.message_reference as { message_id?: string } | undefined;

  if (!author || author.bot) return;
  if (!channelId || !messageId) return;

  // Content can be missing if intents are misconfigured — use REST fallback.
  let content = (eventData?.content as string | undefined) ?? "";
  if (!content) {
    const full = await fetchMessage(channelId, messageId);
    content = full?.content ?? "";
  }

  if (!content) return;
  if (!isExplicitBotMention(content)) return;
  if (hasAlreadyResponded(messageId)) return;

  markAsResponded(messageId);

  let repliedToContent: string | undefined;
  let repliedToAuthor: string | undefined;
  if (messageReference?.message_id) {
    const replied = await fetchMessage(channelId, messageReference.message_id);
    if (replied) {
      repliedToContent = replied.content;
      repliedToAuthor = replied.author?.username;
    }
  }

  let question = stripBotMention(content);
  if (!question && repliedToContent) question = repliedToContent;
  if (!question) {
    await sendMessage(channelId, "Please include your question after tagging me.", messageId);
    return;
  }

  await triggerTyping(channelId);

  const reply = await getScholarisResponse({
    message: question,
    discordUserId: author.id,
    username: author.username,
    displayName: author.global_name,
    repliedToContent,
    repliedToAuthor,
  });

  await sendMessage(channelId, reply, messageId);
}

// ============ HEARTBEAT + RECONNECT ============

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
  } catch {
    // ignore
  }
}

function connect(): void {
  if (isConnecting) return;
  isConnecting = true;
  clearReconnectTimeout();

  const url = resumeGatewayUrl || DISCORD_GATEWAY_URL;
  console.log(`Connecting to Discord Gateway: ${url}`);

  safeClose(1000, "reconnecting");
  ws = new WebSocket(url);

  ws.onopen = () => {
    isConnecting = false;
    reconnectAttempts = 0;
    console.log("WebSocket connected");
  };

  ws.onmessage = async (event) => {
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    const { op, t, s, d } = payload;
    if (s) sequence = s;

    switch (op) {
      case 10: {
        const intervalMs = d.heartbeat_interval;
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, intervalMs);
        sendHeartbeat();

        if (ws && ws.readyState === WebSocket.OPEN) {
          if (sessionId && sequence) {
            ws.send(JSON.stringify({ op: 6, d: { token: DISCORD_BOT_TOKEN, session_id: sessionId, seq: sequence } }));
          } else {
            ws.send(JSON.stringify({
              op: 2,
              d: {
                token: DISCORD_BOT_TOKEN,
                intents: INTENTS,
                properties: { os: "linux", browser: "lovable-bot", device: "lovable-bot" },
              },
            }));
          }
        }
        break;
      }

      case 0: {
        if (t === "READY") {
          sessionId = d.session_id;
          resumeGatewayUrl = d.resume_gateway_url;
          botUserId = d.user?.id;
          console.log(`Ready. Bot user ID: ${botUserId}`);
        }

        if (t === "MESSAGE_CREATE") {
          await handleMessage(d);
        }
        break;
      }

      case 7:
        pendingReconnect = { delayMs: 2500, reason: "gateway_op7_reconnect" };
        safeClose(1000, "gateway_reconnect");
        break;

      case 9:
        sessionId = null;
        resumeGatewayUrl = null;
        sequence = null;
        pendingReconnect = { delayMs: 2000 + Math.floor(Math.random() * 3000), reason: "gateway_invalid_session" };
        safeClose(1000, "invalid_session");
        break;
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };

  ws.onclose = (event) => {
    isConnecting = false;
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    reconnectAttempts += 1;
    let delayMs = pendingReconnect?.delayMs;
    let reason = pendingReconnect?.reason ?? `close_${event.code}`;
    pendingReconnect = null;

    // Helpful Discord codes
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

console.log("Starting Scholaris Discord Gateway Bot (mention-only)...");
await fetchBotIdentity();
connect();

setInterval(() => {
  console.log("Bot is running...");
}, 60_000);
