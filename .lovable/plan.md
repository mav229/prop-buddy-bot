
# Plan: Improve Discord Bot Response Quality & Formatting

## Overview
Enhance the Scholaris Discord bot to provide cleaner, more visually appealing responses that are optimized for Discord's rendering engine while maintaining the professional, warm tone.

---

## Current State Analysis

The bot currently uses:
- Double line breaks between paragraphs
- Basic bullet points (`•`)  
- Bold text with `**asterisks**`
- A system prompt that's quite verbose with examples

### Issues Identified:
1. **Overly long system prompt** - Too many formatting examples dilute the core instructions
2. **No Discord-native formatting** - Missing Discord features like code blocks, quote blocks, and headers
3. **Inconsistent greeting styles** - Multiple conflicting greeting instructions
4. **No character limits awareness** - Bot may produce overly long responses
5. **Plain URLs** - No visual hierarchy for links

---

## Proposed Improvements

### 1. Enhanced Discord-Native Formatting

```text
┌─────────────────────────────────────────────────────────────────┐
│ BEFORE (Current)                                                │
├─────────────────────────────────────────────────────────────────┤
│ **Available Sizes:**                                            │
│                                                                 │
│ • **2K Challenge** → $29 (₹2,610)                               │
│ • **5K Challenge** → $49 (₹4,410)                               │
├─────────────────────────────────────────────────────────────────┤
│ AFTER (Improved)                                                │
├─────────────────────────────────────────────────────────────────┤
│ ## 📊 Available Sizes                                           │
│                                                                 │
│ > **2K Challenge** — $29 (₹2,610)                               │
│ > **5K Challenge** — $49 (₹4,410)                               │
│                                                                 │
│ ✅ No time limits • Unlimited retakes • Fast payouts            │
└─────────────────────────────────────────────────────────────────┘
```

**New formatting features:**
- Discord headers (`##`) for section titles
- Quote blocks (`>`) for list items (renders nicely in Discord)
- Single-line bullet summaries with `•` separator for quick facts
- Strategic emoji headers (1 per section max)
- Em-dash (`—`) instead of arrows for cleaner look

### 2. Streamlined System Prompt

Consolidate the verbose formatting instructions into a cleaner, more focused prompt:

**Key changes:**
- Remove redundant examples
- Add explicit Discord formatting rules
- Set character limit guidance (under 1500 chars for readability)
- Remove conflicting greeting instructions
- Add "scannable" formatting priority

### 3. Smart Response Sections

For complex answers, use a consistent structure:

```text
[Quick Answer]
[Details/Breakdown]  
[Action/Next Steps]
```

### 4. Warm but Concise Greetings

Standardize to 3 approved greeting styles:
- "Hey! 👋" (casual)
- "Absolutely!" (affirming)
- "Great question!" (engaging)

Remove overly formal or repetitive greetings like "Yes sir, how can I help you? 🙏"

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/discord-bot/index.ts` | Update `SYSTEM_PROMPT` with improved formatting rules |
| `supabase/functions/discord-bot/index.ts` | Add response post-processing to clean up formatting |
| `discord-gateway-bot/bot.ts` | No changes needed (just sends messages) |

### New System Prompt Structure

```typescript
const SYSTEM_PROMPT = `You ARE Scholaris AI - PropScholar's official Discord support.

PERSONALITY:
- Professional, confident, concise
- Speak as "we" - you represent PropScholar
- Max 1-2 emojis per response (headers only)

DISCORD FORMATTING (MANDATORY):
1. Use ## for section headers (with 1 emoji)
2. Use > for list items (quote blocks)
3. Use **bold** for prices, percentages, key terms
4. Use — (em-dash) instead of arrows
5. Keep responses under 1500 characters
6. One blank line between sections

RESPONSE STRUCTURE:
[Greeting] → 1 short sentence
[Answer] → 2-3 short paragraphs max
[Key Points] → Quote block list if needed
[Call to Action] → Optional next step

EXAMPLE:
Hey! 👋

## 💰 Challenge Pricing

> **2K Challenge** — $29 (₹2,610)
> **5K Challenge** — $49 (₹4,410)  
> **10K Challenge** — $99 (₹8,910)

All include no time limits and unlimited retakes.

Let me know which size interests you!

RULES:
- Never make up facts
- No markdown links [text](url) - paste URLs directly
- If unsure: "Let me check with the team on that"

KNOWLEDGE BASE:
{knowledge_base}

{learned_corrections}

ACTIVE COUPONS:
{coupons_context}`;
```

### Post-Processing Function

Add a cleanup function to ensure consistent formatting:

```typescript
function cleanDiscordResponse(text: string): string {
  return text
    // Ensure double newlines after headers
    .replace(/^(##.+)$/gm, '$1\n')
    // Convert → to —
    .replace(/→/g, '—')
    // Limit consecutive newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}
```

---

## Summary of Improvements

| Aspect | Before | After |
|--------|--------|-------|
| Headers | Bold text only | Discord `##` headers with emoji |
| Lists | Plain bullets `•` | Quote blocks `>` |
| Structure | Inconsistent | Quick answer → Details → Action |
| Length | No limit | Under 1500 chars |
| Greetings | Multiple conflicting styles | 3 standardized options |
| System prompt | ~150 lines with examples | ~50 focused lines |

---

## Files Changed

1. **`supabase/functions/discord-bot/index.ts`**
   - Replace `SYSTEM_PROMPT` constant with new streamlined version
   - Add `cleanDiscordResponse()` post-processing function
   - Apply cleanup before returning AI response

This will make the bot's responses cleaner, more scannable, and optimized for Discord's message rendering while maintaining the warm, professional tone.
