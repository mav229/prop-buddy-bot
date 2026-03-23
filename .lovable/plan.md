

## Plan: Improve Discord Widget Email Detection

The code you shared (from your PropScholar dashboard) retrieves the user email from `localStorage.getItem("userEmail")` — which is fragile. Based on your existing patterns, the widget already supports receiving email via the `?email=` query param and `window.postMessage`.

### What needs to change

**On the PropScholar dashboard side** (the code you shared — NOT in this project):

The email retrieval should try multiple sources in order:
1. **Decode the `propscholar_access_token` JWT** from localStorage (most reliable — this is the actual auth token)
2. **Fall back to `localStorage.getItem("userEmail")`** as a backup
3. **Listen for `window.postMessage`** events (for dynamic updates)

Here's the production-ready code for your dashboard:

```tsx
useEffect(() => {
  // 1. Try decoding JWT token (most reliable)
  const token = localStorage.getItem("propscholar_access_token");
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const decoded = payload.email || payload.user_email || payload.sub || "";
      if (decoded && decoded.includes("@")) {
        setUserEmail(decoded);
        return;
      }
    } catch (e) {
      console.warn("Failed to decode token:", e);
    }
  }

  // 2. Fallback to explicit localStorage key
  const stored = localStorage.getItem("userEmail") || "";
  if (stored) setUserEmail(stored);
}, []);
```

### On this project's side (Scholaris)

The `/discord-widget` page already handles the `?email=` param correctly — **no changes needed here**. The widget receives the email via the iframe URL and passes it to `DiscordConnectWidget`.

### Summary

This is a **dashboard-side fix only** — the improved email extraction logic goes into your PropScholar dashboard codebase, not this project. The JWT decode approach matches the pattern described in your auto-personalization flow.

