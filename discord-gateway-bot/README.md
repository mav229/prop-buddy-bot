# Discord Gateway Bot (Mention-Only)

This bot responds **only when @mentioned** in any channel it has access to.

## Features

- ✅ Responds only to @mentions (not normal messages)
- ✅ Uses your Lovable backend (no extra API keys needed!)
- ✅ Auto-reconnects if disconnected

## Environment Variables (Only 3 needed!)

| Variable | Value |
|----------|-------|
| `DISCORD_BOT_TOKEN` | Get from [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Reset Token |
| `SUPABASE_URL` | `https://pcvkjrxrlibhyyxldbzs.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E` |

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

## Deploy to Render

1. Create account at [render.com](https://render.com)
2. Click **New** → **Background Worker**
3. Connect your repo or use **Docker**
4. Settings:
   - Runtime: Docker
   - Use the Dockerfile in this folder
5. Add environment variables:
   ```
   DISCORD_BOT_TOKEN=your_token_here
   SUPABASE_URL=https://pcvkjrxrlibhyyxldbzs.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E
   ```
6. Deploy!

## Deploy to Railway

1. Create account at [railway.app](https://railway.app)
2. Click **New Project** → **Deploy from GitHub repo**
3. Add environment variables in **Variables** tab
4. Deploy!

## Deploy to Fly.io

1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Login: `fly auth login`
3. Create `fly.toml`:
   ```toml
   app = "propscholar-discord-bot"
   primary_region = "iad"

   [build]
     image = "denoland/deno:1.40.0"

   [processes]
     app = "deno run --allow-net --allow-env bot.ts"
   ```
4. Create app: `fly launch`
5. Set secrets:
   ```bash
   fly secrets set DISCORD_BOT_TOKEN=your_token
   fly secrets set SUPABASE_URL=https://pcvkjrxrlibhyyxldbzs.supabase.co
   fly secrets set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
6. Deploy: `fly deploy`

## Local Testing

```bash
# Set environment variables
export DISCORD_BOT_TOKEN=your_token
export SUPABASE_URL=https://pcvkjrxrlibhyyxldbzs.supabase.co
export SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjdmtqcnhybGliaHl5eGxkYnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4ODE5MTgsImV4cCI6MjA4MjQ1NzkxOH0.Ix2sX2oONBKUY-V7PVAnY7FO33TXvm_imZvMuCk849E

# Run
deno run --allow-net --allow-env bot.ts
```

## How It Works

1. Bot connects to Discord via WebSocket (Gateway API)
2. Listens for MESSAGE_CREATE events
3. Only responds when @mentioned
4. Calls your Lovable backend `/chat` function
5. Backend fetches knowledge base + generates AI response
6. Bot sends reply in the same channel
