FROM denoland/deno:1.40.0

WORKDIR /app

# Use the gateway bot implementation (mention-only + per-user memory)
COPY discord-gateway-bot/bot.ts ./bot.ts

CMD ["run", "--allow-net", "--allow-env", "bot.ts"]
