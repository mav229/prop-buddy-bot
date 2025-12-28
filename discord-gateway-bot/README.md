# Discord Gateway Bot (Mention-Only)

This bot responds **only when @mentioned** in any channel it has access to.

## Features

- Responds only to @mentions (not normal messages, not /commands)
- Uses your Supabase knowledge base for context
- AI-powered responses via Lovable AI Gateway
- Auto-reconnects if disconnected

## Environment Variables

Create these in your deployment platform:

```
DISCORD_BOT_TOKEN=your_discord_bot_token
SUPABASE_URL=https://pcvkjrxrlibhyyxldbzs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LOVABLE_API_KEY=your_lovable_api_key
```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your bot application
3. Go to **Bot** → Enable these **Privileged Gateway Intents**:
   - ✅ MESSAGE CONTENT INTENT
   - ✅ SERVER MEMBERS INTENT (optional)
4. Go to **OAuth2** → **URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Read Message History`, `View Channels`
5. Use the generated URL to invite the bot to your server

## Deploy to Railway

1. Create account at [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo** or **Empty Project**
3. If empty project, go to **Settings** → **Deploy** → Add this:
   ```
   Build Command: (leave empty)
   Start Command: deno run --allow-net --allow-env bot.ts
   ```
4. Add environment variables in **Variables** tab
5. Deploy!

## Deploy to Render

1. Create account at [render.com](https://render.com)
2. Click **New** → **Background Worker**
3. Connect your repo or use **Docker**
4. Settings:
   ```
   Runtime: Docker (or use Dockerfile below)
   Start Command: deno run --allow-net --allow-env bot.ts
   ```
5. Add environment variables
6. Deploy!

**Dockerfile for Render:**
```dockerfile
FROM denoland/deno:1.40.0
WORKDIR /app
COPY bot.ts .
CMD ["run", "--allow-net", "--allow-env", "bot.ts"]
```

## Deploy to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Create `fly.toml`:
   ```toml
   app = "propscholar-discord-bot"
   primary_region = "iad"

   [build]
     image = "denoland/deno:1.40.0"

   [env]
     # Add non-secret env vars here

   [processes]
     app = "deno run --allow-net --allow-env bot.ts"
   ```
4. Create app: `fly launch`
5. Set secrets:
   ```bash
   fly secrets set DISCORD_BOT_TOKEN=xxx
   fly secrets set SUPABASE_URL=xxx
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
   fly secrets set LOVABLE_API_KEY=xxx
   ```
6. Deploy: `fly deploy`

## Local Testing

```bash
# Set environment variables
export DISCORD_BOT_TOKEN=your_token
export SUPABASE_URL=https://pcvkjrxrlibhyyxldbzs.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_key
export LOVABLE_API_KEY=your_key

# Run
deno run --allow-net --allow-env bot.ts
```

## How It Works

1. Bot connects to Discord via WebSocket (Gateway API)
2. Listens for MESSAGE_CREATE events
3. Only responds when @mentioned
4. Fetches knowledge base from Supabase
5. Generates AI response via Lovable AI
6. Sends reply in the same channel

## Notes

- This is a **separate deployment** from your Lovable app
- The existing `/ask` command still works independently
- You can run both simultaneously
