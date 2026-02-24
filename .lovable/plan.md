## Auto-Personalized Scholaris Widget for PropScholar Dashboard

When Scholaris is embedded in the PropScholar dashboard, the logged-in user's email will be passed automatically so Scholaris instantly becomes their personal assistant -- no verification needed.

### How It Works

1. **PropScholar dashboard passes the user's email** to the Scholaris iframe via a URL parameter (e.g., `scholaris.space/fullpage?email=user@example.com`) or via `postMessage` after the iframe loads.
2. **Scholaris reads the email on load**, pre-fetches all account data from MongoDB, and greets the user personally (e.g., "Hey Om! I can see your accounts. How can I help?").
3. **No verification step needed** -- since the user is already authenticated on PropScholar, the email is trusted. The chat skips the "provide your email + account number" flow.

### Technical Changes

**1. Fullpage embed (`src/components/FullpageChat.tsx`) and Embeddable chat (`src/components/EmbeddableChat.tsx`)**

- Read `email` from URL query params (`?email=...`)
- Also listen for `postMessage` of type `scholaris:user` with `{ email }` from the parent window
- Store the email in state and pass it to `useChat`

**2. Chat hook (`src/hooks/useChat.ts`)**

- Accept an optional `preloadEmail` parameter
- Include `userEmail` in the request body sent to the chat edge function so MongoDB context loads on the very first message (no need for email to appear in conversation)

**3. Chat edge function (`supabase/functions/chat/index.ts`)**

- Accept an optional `userEmail` field in the request body
- If `userEmail` is provided, use it for MongoDB lookup (priority over emails extracted from messages)
- Inject a note into the system prompt: "The user is pre-authenticated from the PropScholar dashboard. Their email is {email}. Skip identity verification -- they are already verified. Greet them by name if available."

**4. Embedding instructions for PropScholar**
The PropScholar team embeds the iframe like:

```text
<iframe src="https://scholaris.space/fullpage?email=USER_EMAIL_HERE" ...>
```

Or sends the email via postMessage after load:

```text
iframe.contentWindow.postMessage({ type: "scholaris:user", email: "user@email.com" }, "*")
```

### What the User Experiences

- Opens the support page on PropScholar dashboard
- Scholaris loads and already knows who they are
- They can immediately ask "What's my account status?" or "Am I breached?" without providing email/account number
- Scholaris shows their accounts, orders, payouts -- fully personalized from the first message  
  
Also make sure this happens only in 16:9 widegt for now make it good flow and let me know anything to update from my side in website try that its not needed bro everything happen without changing website still if needed do it