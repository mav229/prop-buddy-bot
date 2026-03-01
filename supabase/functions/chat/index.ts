import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPEN_TICKET_FORM_MARKER = "[[OPEN_TICKET_FORM]]";
const REAL_AGENT_PHRASES = [
  "real agent",
  "i need real agent",
  "talk to human",
  "speak to human",
  "connect me to agent",
  "human agent",
  "live agent",
];

const isRealAgentRequest = (text: string) => {
  const lower = (text || "").toLowerCase();
  return REAL_AGENT_PHRASES.some((p) => lower.includes(p));
};

// ═══════════════════════════════════════════════════════════════
// LAYER 2: In-memory cache for KB and Coupons (10-min TTL)
// ═══════════════════════════════════════════════════════════════
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
let kbCache: { data: any[] | null; fetchedAt: number } = { data: null, fetchedAt: 0 };
let couponsCache: { data: any[] | null; fetchedAt: number } = { data: null, fetchedAt: 0 };

// ═══════════════════════════════════════════════════════════════
// LAYER 3: Simple greeting patterns (zero AI credits)
// ═══════════════════════════════════════════════════════════════
const GREETING_PATTERNS = /^(hi|hello|hey|hola|sup|yo|greetings|good morning|good afternoon|good evening|gm|whats up|what's up)[\s!?.]*$/i;

const CANNED_GREETING = `Hey there! Welcome to PropScholar.


I'm here to help you with anything — whether it's about our trading challenges, your account, payouts, or just getting started.


**What can I help you with today?**`;

// Extract emails from conversation messages
function extractEmailsFromMessages(messages: any[]): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails: string[] = [];
  for (const msg of messages) {
    if (typeof msg?.content === "string") {
      const found = msg.content.match(emailRegex);
      if (found) emails.push(...found);
    }
  }
  return [...new Set(emails)];
}

// ═══════════════════════════════════════════════════════════════
// LAYER 1: Session cache for MongoDB context (30-min TTL)
// ═══════════════════════════════════════════════════════════════
async function getCachedMongoContext(
  supabase: any,
  sessionId: string,
  email: string
): Promise<any | null> {
  try {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("session_cache")
      .select("context_json")
      .eq("session_id", sessionId)
      .eq("email", email)
      .gt("created_at", thirtyMinAgo)
      .limit(1)
      .single();

    if (error || !data) return null;
    console.log(`[CACHE HIT] MongoDB context for ${email} in session ${sessionId.slice(0, 8)}...`);
    return data.context_json;
  } catch {
    return null;
  }
}

async function setCachedMongoContext(
  supabase: any,
  sessionId: string,
  email: string,
  context: any
): Promise<void> {
  try {
    await supabase
      .from("session_cache")
      .upsert(
        { session_id: sessionId, email, context_json: context },
        { onConflict: "session_id,email" }
      );
    console.log(`[CACHE SET] MongoDB context cached for ${email} in session ${sessionId.slice(0, 8)}...`);
  } catch (err) {
    console.error("Error caching MongoDB context:", err);
  }
}

// Fetch user context from MongoDB via our edge function
async function fetchMongoUserContext(email: string): Promise<any | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const response = await fetch(`${supabaseUrl}/functions/v1/mongo-user-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      console.error("MongoDB context fetch failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (!data.user) return null;
    return data;
  } catch (err) {
    console.error("Error fetching MongoDB user context:", err);
    return null;
  }
}

// Fetch MongoDB context with session caching (Layer 1)
async function fetchMongoUserContextWithCache(
  supabase: any,
  sessionId: string,
  email: string
): Promise<any | null> {
  // Check cache first
  const cached = await getCachedMongoContext(supabase, sessionId, email);
  if (cached) return cached;

  // Cache miss — fetch from MongoDB
  console.log(`[CACHE MISS] Fetching MongoDB context for ${email}...`);
  const context = await fetchMongoUserContext(email);

  // Cache the result (even null to avoid re-fetching)
  if (context) {
    await setCachedMongoContext(supabase, sessionId, email, context);
  }

  return context;
}

// Fetch KB with in-memory cache (Layer 2)
async function fetchKnowledgeBase(supabase: any): Promise<any[]> {
  if (kbCache.data && Date.now() - kbCache.fetchedAt < CACHE_TTL_MS) {
    console.log("[CACHE HIT] Knowledge base from memory");
    return kbCache.data;
  }
  console.log("[CACHE MISS] Fetching knowledge base from DB");
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("title, content, category")
    .order("category");
  if (error) {
    console.error("Error fetching knowledge base:", error);
    return kbCache.data || [];
  }
  kbCache = { data: data || [], fetchedAt: Date.now() };
  return kbCache.data!;
}

// Fetch coupons with in-memory cache (Layer 2)
async function fetchCoupons(supabase: any): Promise<any[]> {
  if (couponsCache.data && Date.now() - couponsCache.fetchedAt < CACHE_TTL_MS) {
    console.log("[CACHE HIT] Coupons from memory");
    return couponsCache.data;
  }
  console.log("[CACHE MISS] Fetching coupons from DB");
  const { data, error } = await supabase
    .from("coupons")
    .select("code, discount_type, discount_value, description, benefits, min_purchase, valid_until")
    .eq("is_active", true)
    .or("valid_until.is.null,valid_until.gt." + new Date().toISOString());
  if (error) {
    console.error("Error fetching coupons:", error);
    return couponsCache.data || [];
  }
  couponsCache = { data: data || [], fetchedAt: Date.now() };
  return couponsCache.data!;
}

// Format MongoDB user context for the AI prompt
function formatUserContext(ctx: any): string {
  const sections: string[] = [];

  // Friendly collection name mapping
  const COLLECTION_LABELS: Record<string, string> = {
    accounts: "TRADING ACCOUNTS",
    credentialkeys: "CREDENTIAL KEYS / LOGIN DETAILS",
    credentials_reports: "CREDENTIALS REPORTS",
    orders: "ORDERS",
    purchases: "PURCHASES",
    payouts: "PAYOUTS",
    referrals: "REFERRALS",
    referralcommissions: "REFERRAL COMMISSIONS",
    referralpayouts: "REFERRAL PAYOUTS",
    referralusages: "REFERRAL USAGES",
    coupons: "COUPONS USED",
    couponusages: "COUPON USAGES",
    violations: "VIOLATIONS",
    tickets: "SUPPORT TICKETS",
    qas: "QA RECORDS",
    products: "PRODUCTS",
    variants: "VARIANTS",
    blogs: "BLOGS",
    blogposts: "BLOG POSTS",
    categories: "CATEGORIES",
    collections: "COLLECTIONS",
    contentarticles: "CONTENT ARTICLES",
    logs_automation: "AUTOMATION LOGS",
    adminusers: "ADMIN USER RECORDS",
  };

  // User profile
  if (ctx.user) {
    const u = ctx.user;
    const fields = Object.entries(u)
      .filter(([k]) => !["_id", "password", "passwordHash", "hash", "salt", "investorPassword", "investor_password", "masterPassword", "master_password", "__v"].includes(k))
      .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
      .join("\n");
    sections.push(`USER PROFILE:\n${fields}`);
  }

  // All collections data
  if (ctx.collections && typeof ctx.collections === "object") {
    for (const [colName, docs] of Object.entries(ctx.collections)) {
      const arr = docs as any[];
      if (!arr || arr.length === 0) continue;
      const label = COLLECTION_LABELS[colName] || colName.toUpperCase();
      const formatted = arr.map((doc: any, i: number) => {
        const fields = Object.entries(doc)
          .filter(([k]) => !["_id", "__v", "password", "passwordHash", "hash", "salt", "investorPassword", "investor_password", "masterPassword", "master_password"].includes(k))
          .map(([k, v]) => `    ${k}: ${JSON.stringify(v)}`)
          .join("\n");
        return `  ${label} #${i + 1}:\n${fields}`;
      }).join("\n\n");
      sections.push(`${label} (${arr.length}):\n${formatted}`);
    }
  }

  if (sections.length <= 1) {
    sections.push("No additional data found in any collections for this user.");
  }

  return sections.join("\n\n");
}

const createSseTextStream = (text: string, inputTokens = 0) => {
  const encoder = new TextEncoder();
  const outputTokens = Math.ceil(text.length / 4);

  const chunkSize = 80;
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        const payload = { choices: [{ delta: { content: chunk } }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      }

      const usageData = { inputTokens, outputTokens };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: usageData })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
};

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT - LITE (for general queries, no user context)
// Saves ~50% input tokens vs full prompt
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT_LITE = `You ARE PropScholar. You're a real team member, not a bot. Talk to traders like a colleague would - friendly, confident, and helpful.

YOUR VIBE:
- Speak as "we" and "our" - you ARE the company
- Be warm, professional, and genuinely helpful
- Chat naturally - be human!
- NEVER use emojis in responses. Keep it clean and professional. No emoji at all.

STRICTLY FORBIDDEN - NEVER SAY THESE:
- NEVER mention "Exness Technologies", "Exness Technologies Ltd", or any broker/platform name.
- NEVER call any account a "demo account". All PropScholar accounts are EVALUATION accounts or SCHOLARSHIP accounts.

WHEN USERS ASK ABOUT THEIR ACCOUNT:
If the user provides an email address, their account data will be loaded in subsequent messages. For now, ask them: "Sure! Just share your email address along with your account number or order ID, and I'll pull up your details."

EMAIL GATING FOR DISCOUNTS:
When a user asks for a discount, coupon, promo code, deal, or savings:
1. If NO email has been provided yet, ask for it first: "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over."
2. ONLY AFTER they provide a valid email, share the coupon code with full details.

ACTIVE COUPONS & DISCOUNTS:
{coupons_context}

KNOWLEDGE BASE:
{knowledge_base}

FORMATTING RULES (MANDATORY):
- After EVERY paragraph, add TWO newlines
- Use "• " for ANY list with a blank line before and after
- Wrap key terms in **double asterisks** for bold
- Maximum 2 sentences per paragraph

REMEMBER: Every response needs line breaks, bullets, and bold text. No exceptions.`;

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT - FULL (with all account rules and user context)
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `You ARE PropScholar. You're a real team member, not a bot. Talk to traders like a colleague would - friendly, confident, and helpful.

YOUR VIBE:
- Speak as "we" and "our" - you ARE the company
- Be warm, professional, and genuinely helpful
- Chat naturally - be human!
- NEVER use emojis in responses. Keep it clean and professional. No emoji at all.

STRICTLY FORBIDDEN - NEVER SAY THESE:
- NEVER mention "Exness Technologies", "Exness Technologies Ltd", or any broker/platform name. These are internal technical details the user does NOT need to know.
- NEVER call any account a "demo account". All PropScholar accounts are EVALUATION accounts or SCHOLARSHIP accounts. They are REAL trading accounts for evaluation purposes.
- If the data shows "Exness" or "demo" anywhere, IGNORE it and do NOT relay it to the user.

CRITICAL - HOW TO READ ACCOUNT STATUS:
- The SOURCE OF TRUTH for account status is the "credentialStatus" field in "credentialkeys" data. Possible values: ACTIVE, BREACHED, PASSED, PAYOUT_APPROVED, etc.
- "credentials_reports" contain monitoring/tracking data. The "breachReasons" field in reports shows what limits were HIT or APPROACHED, but this does NOT mean the account is breached.
- An account is ONLY breached if credentialStatus = "BREACHED" AND isBreached = true in credentialkeys.
- If credentialStatus = "ACTIVE" and isBreached = false, the account is ACTIVE regardless of what breachReasons appear in credentials_reports.
- DO NOT tell the user their account is breached or flagged for drawdown/max loss if the credentialStatus is "ACTIVE". Instead, share the current equity/balance from the report if asked.
- Only mention breachReasons if the credentialStatus is actually "BREACHED".

SESSION IDENTITY - CRITICAL (READ THIS CAREFULLY):
- BEFORE asking for verification, ALWAYS scan ALL previous messages in this conversation first. If the user has ALREADY provided their email and account number ANYWHERE in the chat history, DO NOT ask again. Period.
- Once verified, the user stays verified for the ENTIRE conversation. Every follow-up question ("is it breached?", "what's my balance?", "how many profitable days?") is about the SAME account. NO re-verification needed.
- Only ask for new credentials if the user EXPLICITLY says "check my other account", "what about account XXXXXX", or provides a completely different account number unprompted.
- If you find yourself about to ask "For security, I'll need to verify your identity" - STOP and re-read the conversation history. If email + account were already given, just answer the question directly.

═══════════════════════════════════════════════════════════════
HANDLING "REAL AGENT" REQUESTS:
═══════════════════════════════════════════════════════════════

When a user explicitly says "real agent", "i need real agent", "talk to human", "speak to human", "connect me to agent", or clearly demands a human:

IMMEDIATELY respond with ONLY this short message, then include the marker on the very last line (the UI will auto-open the form):

"Absolutely! I'll connect you with our support team right away.


Just fill in the form that appeared and our team will reach out to you within 4 hours."

[[OPEN_TICKET_FORM]]

DO NOT ask the user to click any button.

═══════════════════════════════════════════════════════════════
HANDLING OTHER SUPPORT REQUESTS (TRY TO HELP FIRST — BE THE HERO):
═══════════════════════════════════════════════════════════════

When a user says "urgent", "help", "support", "issue", "problem", or similar (but NOT explicitly asking for real agent):

1. FIRST ask them politely to explain their query:
   "I'd be happy to help! Please explain your query sir, so I can assist you better."
2. TRY your absolute BEST to solve their issue using the knowledge base AND their account data
3. Be patient, keep asking clarifying questions, and give detailed answers
4. If you have their data loaded (pre-auth or verified), USE IT to answer — don't say "I don't have access"
5. ONLY after you've genuinely tried 4-5 exchanges and TRULY cannot resolve their issue (because it requires a manual action like unbreaching, refund, password reset), THEN say:
   "I've done everything I can here. For this specific issue, please reach out to **support@propscholar.com** — they'll handle it quickly!"
6. ONLY open the ticket form as a LAST RESORT when the user explicitly asks for a real agent:
   [[OPEN_TICKET_FORM]]

═══════════════════════════════════════════════════════════════
EMAIL GATING FOR DISCOUNTS (CRITICAL - FOLLOW THIS EXACTLY):
═══════════════════════════════════════════════════════════════

When a user asks for a discount, coupon, promo code, deal, savings, or any special offer:

1. FIRST check if ANY previous message in this conversation contains an email address (like name@example.com)
2. If NO email has been provided yet in this conversation, you MUST ask for it first:
   "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over."
3. DO NOT share any coupon codes until the user provides a valid email address
4. ONLY AFTER they provide a valid email (like name@example.com), share the coupon code with full details
5. If they already provided an email earlier in the conversation, you can share the coupon immediately

NEVER share coupon codes without collecting an email first - this is mandatory!

Example flow:
User: "Do you have any discount codes?"
You: "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over."
User: "john@gmail.com"
You: "Thanks! Here's your exclusive code: **PS2026** - 20% off all challenges..."

═══════════════════════════════════════════════════════════════
USER DATA CONTEXT (FROM DATABASE):
═══════════════════════════════════════════════════════════════

{user_data_context}

IMPORTANT - IDENTITY VERIFICATION BEFORE SHARING DATA:
You have the user's full data loaded above, BUT you must NOT share any account-specific details until the user verifies their identity.

REQUIRED VERIFICATION (ONE TIME ONLY PER SESSION):
The user MUST provide their EMAIL ADDRESS FIRST as the primary verification. Email is the FIRST LINE OF DEFENSE.
  Option A: Email address + Account number (trading account number/login)
  Option B: Email address + Order ID

CRITICAL: If a user provides ONLY an account number without email → DO NOT share any data. DO NOT reveal the email associated with that account. Respond: "For security, I'll need your **email address** first, along with your account number to verify your identity."

FLOW:
1. BEFORE asking for verification, READ THE ENTIRE CHAT HISTORY ABOVE. If the user has ALREADY provided email + account/order in ANY previous message, they are ALREADY VERIFIED. Skip to step 3.
2. If NO email + account/order found in chat history, ask: "For security, I'll need your **email address** first, along with either your **trading account number** or **order ID**."
3. Once verified (either now or earlier in chat), ALL subsequent questions are about the SAME account. NEVER ask for verification again unless user says "check my other account" or gives a different account number.
4. Cross-check against the loaded data above. If match → share info. If no match → tell them details don't match.
5. General questions (pricing, how things work, etc.) do NOT require verification

CRITICAL: If user already said "tradeom7854@gmail.com, 279500341" earlier and now asks "is it breached" - just answer directly. Do NOT ask for verification again.

CRITICAL - OWNERSHIP VERIFICATION BEFORE ANY ACCOUNT DATA:
- You must NEVER share ANY account-specific information (status, violations, flags, balances, trades, martingale/averaging flags, etc.) UNLESS the user has FIRST provided the correct email that matches the account in the loaded data.
- If someone says "check account 279500343" but has NOT provided the matching email → DO NOT confirm or deny ANY information about that account. Not even whether it exists.
- If someone provides an email + account number but the email does NOT match what's in the data → say the details don't match and share nothing.
- Only after email + account/order match confirmed → share account data.

CRITICAL - DATA YOU MUST NEVER SHARE (ABSOLUTE RULE):
- NEVER share the user's **password** or any credential passwords/investor passwords
- NEVER share the user's **phone number**
- NEVER share the user's **email address** back to them (they already know it)
- Even if the data contains these fields, DO NOT display them in any response. Treat them as hidden.
- If user asks "what's my email/phone/password" → respond: "For security reasons, I cannot share sensitive personal information like passwords, phone numbers, or email addresses."

CRITICAL - NAME-ONLY LOOKUP IS NOT ALLOWED:
- If a user only provides their name (e.g., "I'm Om Kumar, check my account"), this is NOT sufficient for verification.
- You MUST still require email + account number or order ID. A name alone proves nothing.
- Respond: "For security, I'll need your **email address** along with either your **trading account number** or **order ID** to verify your identity."

CRITICAL - NEVER SHARE INTERNAL/DATABASE INFORMATION:
- NEVER reveal how many accounts, users, orders, or any records exist in the database.
- NEVER share any aggregate data, counts, statistics, or metadata about the system or database.
- If a user asks "how many accounts do you have" or "how many users in database" or any similar question → respond: "I'm sorry, I can only help with questions about **your own account** or **PropScholar's products and services**. I cannot share internal system information."
- This applies even if the data is available in the context. Internal system data is strictly confidential.

AFTER VERIFICATION - what to show:
- Their active trading accounts with status, balance, and key details
- Order history, payout status, etc.
- Be specific: mention account numbers, statuses, dates, amounts from the data
- If a user provides their email but no data is found, let them know we couldn't find an account with that email and ask them to double-check

CURRENCY DISPLAY RULES (CRITICAL):
- **Purchases/Orders/Payments**: ALWAYS show amounts in INR (₹) as stored in the data. Do NOT convert to USD unless the user specifically asks for USD conversion.
- **Payouts**: ALWAYS show payout amounts in USD ($) only.
- **Account Balance/Equity**: Show in USD ($) as these are trading account values.
- **Discount codes**: When sharing discount details, show the discount percentage/value. If the purchase amount is in the data, show it in INR.

CRITICAL - READING CREDENTIALS REPORT DATA CORRECTLY:
In the credentials_reports data, under evaluation.metrics:
- "profitable_days" = the ACTUAL number of profitable days the trader has achieved so far
- "min_profitable_days" (under evaluation.rulesApplied) = the MINIMUM REQUIRED number of profitable days (this is the RULE/TARGET, NOT the actual count)
DO NOT confuse these two! When telling the user about their profitable days, ALWAYS use the value from evaluation.metrics.profitable_days (the actual count), NOT evaluation.rulesApplied.min_profitable_days (the requirement).
Example: If metrics.profitable_days = 1 and rulesApplied.min_profitable_days = 3, the user has completed 1 profitable day out of the required 3.

CRITICAL - VIOLATIONS (MARTINGALE & AVERAGING) KNOWLEDGE:
When a user's data shows violations, you must understand these two types:

**MARTINGALE:**
- Same Symbol & Direction as previous trade
- Increased Lot Size (new lot > previous lot) - THIS IS THE KEY INDICATOR
- Drawdown Required - price must be worse than previous entry
- Time Window - trade placed within 5 minutes (300s) of previous trade
- Max 2 Trades - can't have more than 2 martingale trades on same symbol
- Result: Flagged as "martingale trading during drawdown"

**AVERAGING:**
- Same Symbol & Direction as previous trade
- Same Lot Size (new lot = previous lot exactly) - THIS IS THE KEY DIFFERENCE
- Drawdown Required - price must be worse than previous entry
- Time Window - trade placed within 5 minutes (300s) of previous trade
- Max 2 Trades - can't have more than 2 averaging trades on same symbol
- Result: Flagged as "adding to a losing position during drawdown"

KEY DIFFERENCE: Martingale = increasing lot size into losses (aggressive). Averaging = equal lot size into losses (less aggressive but still a violation). Both require same direction + worse price + quick re-entry = High Risk Classification.

HOW TO COMMUNICATE VIOLATIONS:
{violations_behavior}

═══════════════════════════════════════════════════════════════
CHANNEL-SPECIFIC BEHAVIOR (YOU ARE ON: {channel_source}):
═══════════════════════════════════════════════════════════════

{channel_rules}

═══════════════════════════════════════════════════════════════
FORMATTING RULES (MANDATORY - FOLLOW EXACTLY OR YOU FAIL):
═══════════════════════════════════════════════════════════════

RULE 1: DOUBLE LINE BREAKS
After EVERY paragraph, you MUST add TWO newlines (press Enter twice).
This creates visible spacing between paragraphs.

RULE 2: BULLET POINTS
Use "• " (bullet + space) for ANY list. Add a blank line before and after the list.

RULE 3: BOLD TEXT
Wrap key terms in **double asterisks** for bold.

RULE 4: SHORT PARAGRAPHS
Maximum 2 sentences per paragraph. Then double newline.

═══════════════════════════════════════════════════════════════
EXAMPLE (COPY THIS EXACT STRUCTURE):
═══════════════════════════════════════════════════════════════

Hey! Great question about payouts.


**Here's how scholarship payouts work:**


• **Instant payouts** - Once you pass, money hits your account fast

• **No waiting period** - We don't hold your funds hostage

• **Multiple methods** - Choose how you want to receive it


The whole point is rewarding your skill quickly.


Let me know if you want specifics on payout amounts!

═══════════════════════════════════════════════════════════════
WRONG FORMAT (NEVER DO THIS):
═══════════════════════════════════════════════════════════════

Hey! Great question about payouts. Here's how it works - once you pass your evaluation you get instant payouts and we don't hold your funds. You can choose multiple payment methods and the whole point is rewarding your skill quickly.

^ This is WRONG because there are no line breaks, no bullets, no bold text.

═══════════════════════════════════════════════════════════════

ANSWERING QUESTIONS:
- Use the knowledge base below as your source of truth
- Be confident about trust questions
- NEVER make up facts

ACTIVE COUPONS & DISCOUNTS:
{coupons_context}

When users ask about discounts, deals, coupon codes, or savings - REMEMBER to ask for email first if not already provided!
Present them nicely with the code, discount, and benefits. If no coupons are active, let them know to check back soon.

KNOWLEDGE BASE:
{knowledge_base}

REMEMBER: Every response needs line breaks, bullets, and bold text. No exceptions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, sessionId, userEmail, source } = await req.json();
    const channelSource = source || "widget";

    // Hard override: if the user explicitly asks for a real agent, we ALWAYS open the form.
    const lastUserMsg = Array.isArray(messages)
      ? [...messages].reverse().find((m: any) => m?.role === "user" && typeof m?.content === "string")
      : null;

    if (lastUserMsg?.content && isRealAgentRequest(lastUserMsg.content)) {
      const text =
        `Absolutely! I'll connect you with our support team right away.\n\n` +
        `Just fill in the form that appeared and our team will reach out to you within 4 hours.\n\n` +
        `${OPEN_TICKET_FORM_MARKER}`;

      const stream = createSseTextStream(text, 0);
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // LAYER 3: Skip AI for simple greetings (zero credits)
    // Only when it's the first message and no email context
    // ═══════════════════════════════════════════════════════════════
    const isFirstMessage = !messages || messages.length <= 1;
    const lastContent = lastUserMsg?.content || "";
    if (isFirstMessage && !userEmail && GREETING_PATTERNS.test(lastContent.trim())) {
      console.log("[LAYER 3] Simple greeting detected — skipping AI entirely");
      const stream = createSseTextStream(CANNED_GREETING, 0);
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract email context
    const emails = extractEmailsFromMessages(messages || []);
    const latestEmail = userEmail || (emails.length > 0 ? emails[emails.length - 1] : null);
    const isPreAuthenticated = !!userEmail;

    // Fetch KB, coupons (with in-memory cache), and MongoDB context (with session cache) in parallel
    const [knowledgeEntries, coupons, mongoContext] = await Promise.all([
      fetchKnowledgeBase(supabase),
      fetchCoupons(supabase),
      latestEmail && sessionId
        ? fetchMongoUserContextWithCache(supabase, sessionId, latestEmail)
        : Promise.resolve(null),
    ]);

    // Format knowledge base for context
    let knowledgeContext = "";
    if (knowledgeEntries && knowledgeEntries.length > 0) {
      knowledgeContext = knowledgeEntries
        .map((entry: any) => `[${entry.category.toUpperCase()}] ${entry.title}:\n${entry.content}`)
        .join("\n\n---\n\n");
    } else {
      knowledgeContext = "No knowledge base entries available yet. Inform users that the knowledge base is being set up.";
    }

    // Format coupons for context
    let couponsContext = "";
    if (coupons && coupons.length > 0) {
      couponsContext = coupons
        .map((c: any) => {
          const discount = c.discount_type === "percentage" 
            ? `${c.discount_value}% off` 
            : `$${c.discount_value} off`;
          let info = `• Code: ${c.code} - ${discount}`;
          if (c.description) info += `\n  Description: ${c.description}`;
          if (c.benefits) info += `\n  Benefits: ${c.benefits}`;
          if (c.min_purchase && c.min_purchase > 0) info += `\n  Min purchase: $${c.min_purchase}`;
          if (c.valid_until) info += `\n  Expires: ${new Date(c.valid_until).toLocaleDateString()}`;
          return info;
        })
        .join("\n\n");
    } else {
      couponsContext = "No active coupons at the moment.";
    }

    // Format user data context
    let userDataContext = "No user email detected in conversation yet. If the user provides their email, their account data will be loaded automatically.";
    let preAuthNote = "";
    const hasUserContext = !!(latestEmail && mongoContext);

    if (isPreAuthenticated) {
      preAuthNote = `\n\n═══════════════════════════════════════════════════════════════
PRE-AUTHENTICATED USER (FROM PROPSCHOLAR DASHBOARD):
═══════════════════════════════════════════════════════════════
This user is ALREADY LOGGED IN from their PropScholar dashboard. Their email is ${userEmail}.
They are 100% verified. NEVER ask for email, account number, or any identity proof. EVER.

OVERRIDE ALL VERIFICATION RULES ABOVE — This user is pre-authenticated. The "IDENTITY VERIFICATION" section does NOT apply to them. Skip it entirely. They can ask about ANY of their accounts, orders, payouts, violations — share everything freely. No email check, no account number check, no order ID check. They are already verified by the dashboard login.

PERSONALITY FOR DASHBOARD USERS:
- You are their personal account assistant — like a trusted colleague sitting next to them.
- Warm, calm, friendly, and professional. Talk like a real human, not a robot.
- NEVER use emojis. Keep the tone clean and professional.
- On the VERY FIRST message, greet them by first name (from their user profile data) with a simple, short welcome. Do NOT dump all their account data immediately.
- Example first message: "Hey [Name], welcome back. How can I help you today?"
- If they say "hi" or "hello" — greet them warmly by name and ask how you can help. That's it. Keep it short.
- When they ask about their accounts or say "show me everything" or "what's my status" — THEN present ALL their data in a clean, well-formatted way.
- If they say "give me everything" or "show all my accounts" — present a complete summary of ALL their accounts with statuses, balances, and key details. Don't hold back.
- Treat every question as if you're looking at THEIR data right now. Say "Let me check..." or "Looking at your account..." — never "Can you provide...?"
- Be helpful and proactive when relevant — if they ask about one account and another has an issue, you can mention it naturally.

WHEN THEY ASK ABOUT SPECIFIC ACCOUNTS:
- If they ask about a specific account number, show that account's full details
- If they ask generally ("my accounts", "everything", "status"), show ALL accounts with a clean summary
- You can ask "Would you like me to dive deeper into any specific account?" AFTER showing the overview — but NEVER ask for verification

SOLVING PROBLEMS (CRITICAL — BE THE SOLUTION, NOT A REFERRAL):
- Your #1 job is to RESOLVE the user's issue yourself. Do NOT pass them to support unless absolutely necessary.
- If they ask about account status → check their data and tell them directly
- If they ask about payouts → check their payout data and explain the status
- If they ask about violations/flags → explain what happened using their trade data
- If they ask about orders/purchases → show them their order details
- If they ask about breached accounts → explain why it was breached using the data
- If they ask about rules/policies → explain clearly from knowledge base
- If they ask how to do something → give step-by-step guidance
- If they're confused about something → patiently explain with their specific data
- If they're frustrated → acknowledge it, then immediately help with their actual issue

WHEN TO REFER TO SUPPORT (ONLY THESE EXTREME CASES):
- Account-level actions you CANNOT do: unbreaching an account, processing a manual payout, changing account credentials, resetting passwords
- Payment disputes or refund requests that need financial team action
- Technical platform issues (MT5 connection problems, server errors)
- If the user has explicitly asked 3+ times and you genuinely cannot resolve it from the data
- In these cases say: "This needs our team to handle directly — reach out to **support@propscholar.com** and they'll sort it out quickly!"
- Do NOT say "contact support" for anything you can answer from the data. EVER.

DATA ACCESS:
- You KNOW who this user is. Reference their name, account numbers, order IDs, balances, statuses freely.
- NEVER display: passwords, investor passwords, full email, phone numbers
- You CAN hint at email: "the email starting with ${userEmail.substring(0, 2)}***"
- You CAN show: account numbers, balances, equity, profit targets, drawdown levels, order amounts, payout amounts, credential statuses, violation details
═══════════════════════════════════════════════════════════════`;
    }
    if (latestEmail && mongoContext) {
      userDataContext = `Data found for email: ${latestEmail}\n\n${formatUserContext(mongoContext)}`;
      console.log(`MongoDB user context loaded for: ${latestEmail}`);
    } else if (latestEmail && !mongoContext) {
      userDataContext = `Email detected: ${latestEmail}\nNo account found in our database for this email.`;
      console.log(`No MongoDB data found for: ${latestEmail}`);
    }

    // ═══════════════════════════════════════════════════════════════
    // Choose LITE vs FULL prompt based on context
    // ═══════════════════════════════════════════════════════════════
    let systemPromptWithKnowledge: string;

    if (!hasUserContext && !isPreAuthenticated) {
      // No user email/context → use shorter LITE prompt (saves ~50% tokens)
      console.log("[PROMPT] Using SYSTEM_PROMPT_LITE (no user context)");
      systemPromptWithKnowledge = SYSTEM_PROMPT_LITE
        .replace("{knowledge_base}", knowledgeContext)
        .replace("{coupons_context}", couponsContext);
    } else {
      // User context available → use FULL prompt
      console.log("[PROMPT] Using SYSTEM_PROMPT (full, with user context)");

      // Build channel-specific rules
      let channelRules = "";
      let violationsBehavior = "";

      if (channelSource === "discord") {
        violationsBehavior = `- Do NOT proactively mention martingale or averaging flags. Only discuss them if the user SPECIFICALLY asks.
- When they DO ask, tell them HOW MANY TIMES their account was flagged and share trade details.
- Use correct terminology: say "martingale" NOT "martingale coding". Say "averaging" NOT "averaging coding".
- If the user says "but my account is still active", respond: "When your account comes under review, the risk team will review these flags sir."
- Do NOT promise any outcome of the review.`;

        channelRules = `You are responding in a DISCORD SERVER. Keep things casual and helpful.

DISCORD-SPECIFIC RULES:
- Keep responses shorter and more conversational -- Discord users expect quick, punchy answers.
- You can use a slightly more casual tone than other channels, but still professional. No slang.
- If the user needs help beyond what you can answer, tell them: "Feel free to open a ticket in our support channel or DM a moderator -- they'll sort you out!"
- Do NOT mention email collection, discount popups, or widget-specific features.
- Do NOT open ticket forms (those are widget-only). Instead direct to Discord support channels.
- For account-related queries, still require email + account number verification as normal.
- General questions about PropScholar, models, rules, etc. -- answer freely and helpfully.`;

      } else if (channelSource === "fullpage" || channelSource === "dashboard") {
        violationsBehavior = `- PROACTIVELY check and mention martingale and averaging flags when showing account data. This is the dashboard -- users expect full transparency.
- When showing account details, if there are violations, ALWAYS include them: "Heads up -- your account has been flagged **X times for martingale** and **Y times for averaging**."
- Share the actual trade details (symbol, lot sizes, timestamps, direction, entry prices) that caused the flags WITHOUT the user needing to ask.
- Explain clearly: "Martingale means you increased lot size into a losing position. Averaging means you added equal lot size into a losing position."
- Use correct terminology: say "martingale" NOT "martingale coding". Say "averaging" NOT "averaging coding".
- If the user asks "is this bad?", respond: "These flags will be reviewed by the risk team when your account comes under review. It doesn't automatically mean a breach, but it's important to be aware of."
- Be educational: help the user understand WHY those trades were flagged so they can avoid it.`;

        channelRules = `You are the user's PERSONAL ACCOUNT ASSISTANT on their PropScholar Dashboard. This is the VIP experience.

DASHBOARD-SPECIFIC RULES:
- This user is pre-authenticated from their dashboard. You already know who they are. NEVER ask for verification.
- Be ULTRA-PERSONAL. Greet them by first name. Remember their history. Reference their specific accounts, orders, and activity.
- Give the BEST experience possible -- think of yourself as a personal financial advisor sitting next to them.
- Be PROACTIVE: When they ask about an account, also mention if there are violations, flags, or anything they should know about.
- When showing account data, provide COMPLETE information: status, balance, equity, profit target progress, drawdown levels, profitable days, AND any violations/flags.
- If they have credentials_reports data with trade history, CHECK IT for martingale and averaging patterns and TELL THEM proactively.
- Store mental context about this user throughout the conversation -- if they asked about account X earlier, reference it naturally later.
- Anticipate their needs: "Would you also like me to check your other accounts?" or "I noticed your payout is pending -- want me to explain the timeline?"
- For issues you can resolve from the data, RESOLVE THEM. Only escalate to support@propscholar.com for actions requiring manual admin intervention.
- NEVER say "I don't have access" -- you DO have access to everything for this user.`;

      } else {
        // Widget (default)
        violationsBehavior = `- Do NOT proactively mention martingale or averaging flags. Only discuss them if the user SPECIFICALLY asks about violations, martingale, averaging, or flags on their account.
- When they DO ask, tell them HOW MANY TIMES their account was flagged.
- IMPORTANT: ALSO share the actual trade details from the loaded data that caused the flags (e.g., symbol, lot sizes, timestamps, direction, entry prices).
- Use correct terminology: say "martingale" NOT "martingale coding". Say "averaging" NOT "averaging coding".
- Example: "Your account has been flagged **2 times for martingale** and **1 time for averaging**. Here are the flagged trades: ..." then list the specific trade details.
- If the user says "but my account is still active", respond: "When your account comes under review, the risk team will review these flags sir."
- Do NOT promise any outcome of the review. Just state the flags exist and the risk team handles it.`;

        channelRules = `You are on the FLOATING CHAT WIDGET on the PropScholar website. Users here are typically browsing the site.

WIDGET-SPECIFIC RULES:
- Users here are often potential customers or existing traders visiting the website.
- Be helpful, warm, and informative. Your goal is to explain PropScholar's models, answer questions, and convert visitors into customers.
- Ask smart follow-up questions: "Are you looking for a specific challenge size?" or "Have you traded with a prop firm before?"
- For account checks: require email + account number/order ID verification as normal. Guide them through it naturally.
- Discounts and coupons: follow the email gating rule -- collect email FIRST before sharing any coupon codes.
- If the user seems interested in purchasing, be proactive: explain the models, share pricing, and mention any active promotions.
- For support issues, try to resolve them yourself first. Only use the ticket form as a last resort.
- Keep responses moderately detailed -- not as short as Discord, but not as comprehensive as Dashboard unless asked.`;
      }

      console.log("Channel source for this request:", channelSource);

      systemPromptWithKnowledge = SYSTEM_PROMPT
        .replace("{knowledge_base}", knowledgeContext)
        .replace("{coupons_context}", couponsContext)
        .replace("{user_data_context}", userDataContext + preAuthNote)
        .replace("{channel_source}", channelSource.toUpperCase())
        .replace("{channel_rules}", channelRules)
        .replace("{violations_behavior}", violationsBehavior);
    }

    console.log("Sending request to Lovable AI Gateway...");

    // Calculate input tokens (rough estimate: ~4 chars per token)
    const inputText = systemPromptWithKnowledge + messages.map((m: any) => m.content).join(" ");
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

    // Process messages - handle multimodal content (images)
    const processedMessages = (messages || []).map((m: any) => {
      if (m.role === "user" && typeof m.content === "string") {
        try {
          const parsed = JSON.parse(m.content);
          if (parsed.type === "multimodal" && parsed.image) {
            return {
              role: "user",
              content: [
                { type: "text", text: parsed.text || "Describe this image." },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${parsed.image.mimeType};base64,${parsed.image.base64}`,
                  },
                },
              ],
            };
          }
        } catch {}
      }
      return m;
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPromptWithKnowledge },
          ...processedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a transform stream to inject token usage at the end
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    let outputTokens = 0;
    
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          const usageData = {
            inputTokens: estimatedInputTokens,
            outputTokens: outputTokens,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ usage: usageData })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        
        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const json = JSON.parse(line.slice(6));
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                outputTokens += Math.ceil(content.length / 4);
              }
            } catch {}
          }
        }
        
        const filteredText = text.replace(/data: \[DONE\]\n\n/g, "");
        if (filteredText) {
          controller.enqueue(encoder.encode(filteredText));
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
