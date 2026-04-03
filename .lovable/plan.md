

# PropScholar Fix Extension — Production Upgrade Plan

## Current State
- Extension v2.0 with click-to-copy workflow, 3 AI variations (Short/Detailed/Empathetic)
- Backend: `discord-fix` edge function using Gemini 2.5 Flash Lite, fetching `mod_reference_links` + `knowledge_base` for context
- MutationObserver + 2s interval for button injection
- No caching, no usage analytics, no response history

## Upgrades

### 1. Response Caching (reduce API calls + latency)
- Cache AI responses in `localStorage` keyed by a hash of the input text
- TTL of 30 minutes — same message typed again returns instant results
- Show a subtle "cached" indicator so mods know it's a previous result
- Reduces credit consumption significantly for repeated/similar messages

### 2. Usage Analytics Table
- New `extension_usage_logs` table: `id`, `created_at`, `input_text_length`, `response_time_ms`, `template_used` (which of the 3 was copied), `success`
- Log each generation from the edge function (no PII, just metrics)
- Add a simple analytics card in the Admin Dashboard showing daily usage, avg response time, most-picked tone

### 3. Conversation Context Mode
- Allow mods to select/highlight previous messages in the channel before clicking Fix
- Send the context (last 2-3 messages) along with the mod's draft so the AI generates contextually aware replies
- This dramatically improves response quality for ongoing conversations

### 4. Custom Tone Presets (Admin-Configurable)
- New `extension_tone_presets` table: `id`, `name`, `description`, `prompt_instructions`, `is_active`, `sort_order`
- Admin can define custom tones beyond Short/Detailed/Empathetic (e.g., "Formal Warning", "Welcome Message", "Technical Support")
- Edge function fetches active presets and dynamically builds the system prompt
- Extension UI adapts to show however many tones are configured (up to 5)

### 5. Favorite/Pin Responses
- Store frequently used polished messages locally so mods can reuse them
- Add a small "pin" icon on each response; pinned items accessible from the popup menu
- Great for repetitive mod tasks (welcome messages, rule reminders)

### 6. Keyboard Shortcut
- Register `Ctrl+Shift+F` (configurable) as a shortcut to trigger Fix without clicking
- Much faster workflow for power users

### 7. Rate Limit Protection + Offline Graceful Degradation
- Show remaining daily quota in the popup header
- Queue requests if rate-limited instead of failing silently
- Show a clear "Rate limited — try in X seconds" message

### 8. Manifest v3 + Version Bump
- Update manifest version to 2.0.0
- Update popup.html instructions to reflect new features

## Technical Details

### New Database Tables
```sql
-- Usage analytics
CREATE TABLE extension_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  input_length int NOT NULL,
  response_time_ms int,
  tone_selected text, -- 'short', 'detailed', 'empathetic', or custom
  success boolean DEFAULT true
);

-- Custom tone presets
CREATE TABLE extension_tone_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt_instructions text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

### Files Changed
- `extension/content.js` — caching layer, keyboard shortcut, pin system, dynamic tones
- `extension/background.js` — keyboard shortcut registration, analytics logging
- `extension/manifest.json` — version bump, commands registration
- `extension/popup.html` — updated instructions, pinned responses view
- `supabase/functions/discord-fix/index.ts` — dynamic tone presets, usage logging, context mode
- `src/components/AdminDashboard.tsx` — new "Extension" analytics tab
- New: `src/components/ExtensionAnalytics.tsx` — usage charts
- New: `src/components/TonePresetsManager.tsx` — CRUD for custom tones

### Execution Order
1. Create database tables + RLS policies
2. Update edge function (dynamic tones, analytics, context)
3. Update extension files (caching, shortcuts, pins, dynamic UI)
4. Add admin dashboard components
5. Rebuild extension zip

