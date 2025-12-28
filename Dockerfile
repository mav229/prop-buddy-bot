FROM denoland/deno:1.40.0

WORKDIR /app

# Copy bot file
COPY bot.ts .

# Run the bot
CMD ["run", "--allow-net", "--allow-env", "bot.ts"]
