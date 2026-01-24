# PS MOD Bot - Separate Auto-Reply Discord Bot
FROM denoland/deno:1.40.0

WORKDIR /app

# Copy the bot file
COPY bot.ts .

# Cache dependencies
RUN deno cache bot.ts

# Expose port for health checks
EXPOSE 8080

# Run the bot
CMD ["deno", "run", "--allow-net", "--allow-env", "bot.ts"]
