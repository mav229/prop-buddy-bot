FROM denoland/deno:1.40.0

WORKDIR /app

# Copy bot file from discord-gateway-bot folder
COPY discord-gateway-bot/bot.ts .

# Run the bot
CMD ["run", "--allow-net", "--allow-env", "bot.ts"]
