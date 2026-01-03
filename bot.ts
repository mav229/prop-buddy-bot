/**
 * Discord Gateway Bot - Responds only when @mentioned
 *
 * Environment Variables needed:
 * - DISCORD_BOT_TOKEN
 * - SUPABASE_URL (Lovable backend URL)
 * - SUPABASE_ANON_KEY (Lovable publishable/anon key)
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
  return new Response("Discord bot running", { status: 200 });
});

let ws: WebSocket | null = null;
let heartbeatInterval: number | null = null;
let sessionId: string | null = null;
let resumeGatewayUrl: string | null = null;
let sequence: number | null = null;
let botUserId: string | null = null;

// Get AI response by calling the chat edge function
async function getAIResponse(message: string): Promise<string> {
  try {
    console.log("Calling chat edge function...");

    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
        sessionId: `discord-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Chat function error:", response.status, errorText);
      return "Sorry, I'm having trouble processing your request right now.";
    }

    // Handle streaming response - collect all chunks
    const reader = response.body?.getReader();
    if (!reader) {
      return "Sorry, I couldn't get a response.";
    }

    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line || line.startsWith(":")) continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullContent += content;
          }
        } catch {
          // Incomplete JSON, will be handled in next chunk
        }
      }
    }

    return fullContent || "Sorry, I couldn't generate a response.";
  } catch (e) {
    console.error("AI request error:", e);
    return "Sorry, I encountered an error while processing your question.";
  }
}

// Send message to Discord channel
async function sendMessage(
  channelId: string,
  content: string,
  replyToMessageId?: string,
): Promise<void> {
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

    const response = await fetch(
      `${DISCORD_API_BASE}/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

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
function isBotMentioned(
  content: string,
  mentions: Array<{ id: string }>,
): boolean {
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
  return content.replace(new RegExp(`<@!?${botUserId}>`, "g"), "").trim();
}

// Handle incoming message
async function handleMessage(data: Record<string, unknown>): Promise<void> {
  const author = data.author as { id: string; bot?: boolean } | undefined;
  const content = data.content as string | undefined;
  const channelId = data.channel_id as string | undefined;
  const messageId = data.id as string | undefined;
  const mentions = data.mentions as Array<{ id: string }> | undefined;

  // Ignore bot messages
  if (author?.bot) return;

  // Only respond if bot is @mentioned
  if (!content || !channelId || !messageId) return;
  if (!isBotMentioned(content, mentions || [])) return;

  console.log(`Bot mentioned by ${author?.id} in channel ${channelId}`);

  // Clean the message (remove mention)
  const cleanedMessage = cleanMention(content);

  if (!cleanedMessage) {
    await sendMessage(
      channelId,
      "Hi! How can I help you? Please include a question after mentioning me.",
      messageId,
    );
    return;
  }

  // Show typing indicator
  await fetch(`${DISCORD_API_BASE}/channels/${channelId}/typing`, {
    method: "POST",
    headers: { "Authorization": `Bot ${DISCORD_BOT_TOKEN}` },
  });

  // Get AI response via edge function
  const response = await getAIResponse(cleanedMessage);

  // Send response
  await sendMessage(channelId, response, messageId);
  console.log("Response sent successfully");
}

// Send heartbeat
function sendHeartbeat(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: sequence }));
    console.log("Heartbeat sent");
  }
}

// Connect to Discord Gateway
function connect(): void {
  const url = resumeGatewayUrl || DISCORD_GATEWAY_URL;
  console.log(`Connecting to Discord Gateway: ${url}`);

  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connected");
  };

  ws.onmessage = async (event) => {
    const payload = JSON.parse(event.data);
    const { op, t, s, d } = payload;

    // Update sequence number
    if (s) sequence = s;

    switch (op) {
      case 10: {
        // Hello
        const heartbeatIntervalMs = d.heartbeat_interval;
        console.log(`Received Hello, heartbeat interval: ${heartbeatIntervalMs}ms`);

        // Start heartbeat
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(sendHeartbeat, heartbeatIntervalMs);

        // Send initial heartbeat
        sendHeartbeat();

        // Check WebSocket is still open before sending
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.log("WebSocket not open, skipping Identify/Resume");
          break;
        }

        // Identify or Resume
        if (sessionId && sequence) {
          // Resume
          ws.send(
            JSON.stringify({
              op: 6,
              d: {
                token: DISCORD_BOT_TOKEN,
                session_id: sessionId,
                seq: sequence,
              },
            }),
          );
          console.log("Sent Resume");
        } else {
          // Identify
          ws.send(
            JSON.stringify({
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
            }),
          );
          console.log("Sent Identify");
        }
        break;
      }

      case 11:
        // Heartbeat ACK
        console.log("Heartbeat ACK received");
        break;

      case 0:
        // Dispatch
        switch (t) {
          case "READY":
            sessionId = d.session_id;
            resumeGatewayUrl = d.resume_gateway_url;
            botUserId = d.user?.id;
            console.log(`Ready! Bot user ID: ${botUserId}, Session: ${sessionId}`);
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
        // Reconnect
        console.log("Received Reconnect, reconnecting...");
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setTimeout(connect, 1000);
        break;

      case 9:
        // Invalid Session
        console.log("Invalid session, reconnecting fresh...");
        sessionId = null;
        resumeGatewayUrl = null;
        sequence = null;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        setTimeout(connect, 5000);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  ws.onclose = (event) => {
    console.log(`WebSocket closed: ${event.code} ${event.reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    // Reconnect after delay
    setTimeout(connect, 5000);
  };
}

// Start the bot
console.log("Starting Discord Gateway Bot (@mention only)...");
connect();

// Keep the process alive
setInterval(() => {
  console.log("Bot is running...");
}, 60000);
