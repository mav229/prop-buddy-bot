

# Plan: Reduce AI Credits with Smart Caching

## The Problem

Right now, **every single message** triggers:
1. A MongoDB query across 24 collections (expensive)
2. A knowledge base fetch from the database
3. A coupons fetch from the database
4. A massive system prompt (~10,000+ chars) sent to the AI every time

This means even a "hi" costs the same as a complex account query.

## The Solution: 3-Layer Caching

### 1. Cache MongoDB User Context Per Session (Biggest Savings)

Instead of querying MongoDB on every message, cache the result in a Supabase table keyed by `session_id + email`. Only fetch from MongoDB once per session when an email is first detected.

- Create a `session_cache` table with columns: `session_id`, `email`, `context_json`, `created_at`
- On each chat request, check the cache first. If found and less than 30 minutes old, skip MongoDB entirely.
- Only call MongoDB when there's no cache hit.

### 2. Cache Knowledge Base and Coupons In-Memory (Edge Function)

Knowledge base and coupons rarely change. Use a simple in-memory cache with a 10-minute TTL so these aren't fetched from the database on every message.

### 3. Skip AI Entirely for Simple Patterns

For messages like "real agent" requests, you already skip AI. Extend this to other patterns:
- Simple greetings ("hi", "hello") when no email context exists -- respond with a canned greeting via SSE stream (zero AI credits).
- This is optional but can save a lot on casual messages.

## Technical Steps

### Step 1: Create `session_cache` table
```sql
CREATE TABLE public.session_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  email TEXT NOT NULL,
  context_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, email)
);
ALTER TABLE public.session_cache ENABLE ROW LEVEL SECURITY;
-- No RLS policies needed since only edge functions (service role) access this
```

### Step 2: Update `chat/index.ts` -- Add caching logic

**MongoDB context caching:**
```
Before calling fetchMongoUserContext(email):
  1. Check session_cache for (sessionId, email) where created_at > now() - 30 min
  2. If found → use cached context_json, skip MongoDB call
  3. If not found → call MongoDB, then INSERT into session_cache
```

**Knowledge base + coupons in-memory cache:**
```
Global variables at top of edge function:
  let kbCache = { data: null, fetchedAt: 0 }
  let couponsCache = { data: null, fetchedAt: 0 }

Before fetching:
  If cache exists and age < 10 minutes → use cached data
  Otherwise → fetch from DB, update cache
```

### Step 3: Update `chat/index.ts` -- Reduce prompt size for general queries

When no user email/context is detected, use a shorter system prompt that omits all the account verification rules, violation details, and data formatting sections. This alone can cut input tokens by 50%+ for general questions.

```
if (no email detected and no mongo context):
  use SYSTEM_PROMPT_LITE (shorter, general-purpose)
else:
  use full SYSTEM_PROMPT with all account rules
```

## Expected Savings

| Optimization | Credit Reduction |
|---|---|
| MongoDB cache (skip repeat queries) | ~40% fewer edge function calls to MongoDB |
| KB + Coupons in-memory cache | ~20% faster response, fewer DB reads |
| Shorter prompt for general queries | ~50% fewer input tokens on non-account messages |
| **Combined** | **Significant reduction in AI credits per session** |

## Files Changed

- **New migration**: Create `session_cache` table
- **`supabase/functions/chat/index.ts`**: Add all three caching layers + lite prompt

