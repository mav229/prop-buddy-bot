

# Make Dashboard Scholaris Personalized — No Email Re-Asks

## Problem
When a pre-authenticated dashboard user (`/fullpage?email=...`) says "hi", it bypasses the canned greeting (line 705 requires `!userEmail`) and goes straight to AI. The AI then sometimes asks for email despite the pre-auth prompt, and it costs credits for a simple greeting.

**Key constraint from user**: Keep all existing logic intact — MongoDB checks, account checks, daily limits, coupon email-gating for the public widget. Only change behavior for dashboard (`/fullpage`) pre-authenticated users.

## Changes

### 1. New DB table: `widget_user_profiles`
Stores dashboard user memory across sessions.

```sql
CREATE TABLE widget_user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  total_sessions integer DEFAULT 1,
  preferences jsonb DEFAULT '{}'::jsonb
);
ALTER TABLE widget_user_profiles ENABLE ROW LEVEL SECURITY;
-- No public access; edge functions use service role
CREATE POLICY "No public access" ON widget_user_profiles FOR ALL USING (false);
```

### 2. Add personalized canned greeting for dashboard users in `chat/index.ts`

Right after line 705 (the existing `!userEmail` canned greeting), add a new branch:

```
if (isFirstMessage && userEmail && GREETING_PATTERNS.test(lastContent.trim())) {
  // Upsert widget_user_profiles (increment sessions, update last_seen)
  // Extract first name from email prefix (e.g. "john.doe@..." → "John")
  // Return personalized greeting: "Hey John, welcome back. How can I help?"
  // Zero AI credits — instant canned response
}
```

- First-time users: "Hey [Name], welcome to your personal assistant. What can I help with?"
- Returning users (`total_sessions > 1`): "Hey [Name], welcome back. What can I help with today?"

### 3. Add explicit "NEVER ask email" to pre-auth prompt section

In the existing `preAuthNote` block (line 817-868), add one line:

> "This user's email is already confirmed. For coupons or discounts, share them immediately — do NOT ask for email. Do NOT ask for email under ANY circumstance."

This ensures even non-greeting messages never trigger email asks for dashboard users.

## What stays exactly the same
- Public widget: email-gating for coupons, email collection popup, generic canned greeting — all unchanged
- MongoDB lookups, daily account check limit, session cache — all unchanged  
- Discord bot behavior — unchanged
- All existing verification rules for non-dashboard users — unchanged

## Files modified
- `supabase/functions/chat/index.ts` — add personalized greeting branch + strengthen pre-auth prompt
- New migration — create `widget_user_profiles` table

