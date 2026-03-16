# Scholaris Upgrade Plan

## Problem 1: Widget Loading Speed

The widget is slow because:

- **741-line EmbeddableChat component** loads everything upfront (sounds, images, all tabs, email modal, ticket form)
- Multiple large image imports at top-level (5 launcher variants, logo, etc.)
- `preloadAllSounds()` called on open
- `WidgetConfigContext` fetches config from database on every load
- The iframe itself loads the full React app bundle just to render `/widget`

### Fixes

1. **Lazy-load non-critical components** -- `EmailCollectionModal`, `InlineTicketForm`, `ChatSkeleton` should use `React.lazy()` so they're not in the initial bundle
2. **Remove unused launcher image imports** -- Currently importing 5 launcher PNGs at top level; only 1 is ever used. Switch to dynamic import based on config
3. **Defer sound preloading** -- Don't call `preloadAllSounds()` until after first message, not on widget open
4. **Cache widget config in localStorage** -- Show cached config instantly, update in background. Currently every widget load hits the database
5. **Remove the `isReady` artificial delay** -- The 100ms timeout and requestAnimationFrame gate add perceived latency

## Problem 2: New Features

### Feature A: Conversation Search in Admin

Add a search bar to the Chat History tab that lets you search across all conversations by keyword/email. Currently you can only browse sessions one by one.

### Feature B: Auto-Reply / Canned Responses Manager

Add a new admin tab "Auto-Replies" where you can define keyword triggers and automatic responses that bypass AI entirely (zero cost). Example: user says "refund" → instant canned reply with refund policy. Currently only greetings are canned.

### Feature C: Widget Analytics Dashboard

Add real-time widget stats to the Dashboard tab: active sessions right now, average response time, conversation completion rate, most asked questions. Currently the dashboard only shows basic analytics.

### Feature E: Conversation Rating / Feedback

After the bot answers, show a thumbs up/down button. Store ratings in a `chat_ratings` table. Show satisfaction score in admin dashboard. Helps you know if the AI is actually helping.  
  
DO this only in premium dashboard you know that widget only 

---

## Implementation Order

1. **Widget speed fixes** (highest impact, touches `EmbeddableChat.tsx`, `WidgetConfigContext.tsx`, `useSounds.ts`)
2. **Canned Responses Manager** (new admin tab + migration for `auto_replies` table + update chat edge function)
3. **Conversation Rating** (new table + small UI change in `ChatMessage.tsx` + admin stats)
4. **Conversation Search** (update `ChatHistoryView.tsx` + new edge function)
5. **Bulk KB Import** (update `KnowledgeBaseManager.tsx`)

## Files to Edit

- `src/components/EmbeddableChat.tsx` -- lazy imports, remove unused images, defer sounds
- `src/contexts/WidgetConfigContext.tsx` -- add localStorage caching
- `src/hooks/useSounds.ts` -- defer preload
- `src/components/AdminDashboard.tsx` -- add new tabs
- `src/components/ChatMessage.tsx` -- add rating buttons
- `supabase/functions/chat/index.ts` -- integrate auto-replies
- New files for AutoRepliesManager, ChatRatings components
- New migrations for `auto_replies` and `chat_ratings` tables