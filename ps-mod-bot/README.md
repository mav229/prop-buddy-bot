# PS MOD Bot - Separate Auto-Reply Discord Bot

A completely separate Discord bot from Scholaris that handles **only** auto-replies to unanswered questions.

## Features

- Monitors all channels for questions
- Waits for configured delay (default: 2 minutes)
- Only responds if no human has replied
- Uses the same knowledge base as Scholaris
- Professional, human-like tone

## Prerequisites

1. Create a new Discord application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Name it "PS MOD"
3. Go to Bot tab → Reset Token → Copy the token
4. Enable **MESSAGE CONTENT INTENT** under Privileged Gateway Intents
5. Invite the bot to your server using OAuth2 URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Read Message History`, `View Channels`

## Render Deployment

### Step 1: Create a New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `ps-mod-bot`
   - **Region**: Oregon (US West)
   - **Branch**: `main`
   - **Root Directory**: `ps-mod-bot`
   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Instance Type**: Free (or Starter for better uptime)

### Step 2: Add Environment Variables

Click **Environment** and add:

| Key | Value |
|-----|-------|
| `PS_MOD_BOT_TOKEN` | Your PS MOD Discord bot token |
| `SUPABASE_URL` | `https://pcvkjrxrlibhyyxldbzs.supabase.co` |
| `SUPABASE_ANON_KEY` | Your Supabase anon key |

### Step 3: Deploy

Click **Create Web Service** and wait for deployment.

### Step 4: Verify

1. Check the logs for `[PS MOD] Ready!`
2. Send a question in Discord (without mentioning Scholaris)
3. Wait 2 minutes - PS MOD should respond

## Dashboard Control

Control PS MOD settings via the Admin Dashboard:

- **Enable/Disable**: Toggle auto-reply on/off
- **Delay**: Set how long to wait before responding (30-600 seconds)
- **Bot Name**: Customize the personality name

## Differences from Scholaris

| Feature | Scholaris | PS MOD |
|---------|-----------|--------|
| Trigger | @mention or /ask | Any question |
| Response | Immediate | After delay |
| Personality | Primary AI assistant | Support backup |
| Token | DISCORD_BOT_TOKEN | PS_MOD_BOT_TOKEN |

## Troubleshooting

- **Bot not responding**: Check if PS MOD is enabled in dashboard
- **Invalid token error**: Reset token in Discord Developer Portal
- **No questions detected**: Ensure MESSAGE CONTENT INTENT is enabled
