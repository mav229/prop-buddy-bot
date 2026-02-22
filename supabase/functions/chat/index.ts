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

// Fetch user context from MongoDB via our edge function
async function fetchMongoUserContext(email: string): Promise<any | null> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      .filter(([k]) => !["_id", "password", "passwordHash", "hash", "salt", "__v"].includes(k))
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
          .filter(([k]) => !["_id", "__v", "password", "passwordHash", "hash", "salt"].includes(k))
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

const SYSTEM_PROMPT = `You ARE PropScholar. You're a real team member, not a bot. Talk to traders like a colleague would - friendly, confident, and helpful.

YOUR VIBE:
- Speak as "we" and "our" - you ARE the company
- Be warm, professional, and genuinely helpful
- Chat naturally - be human!

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
HANDLING OTHER SUPPORT REQUESTS (TRY TO HELP FIRST):
═══════════════════════════════════════════════════════════════

When a user says "urgent", "help", "support", "issue", "problem", or similar (but NOT explicitly asking for real agent):

1. FIRST ask them politely to explain their query:
   "I'd be happy to help! Please explain your query sir, so I can assist you better 🙂"
2. TRY your best to solve their issue using the knowledge base
3. Be patient and keep asking clarifying questions
4. ONLY after you've genuinely tried 3-4 times and CANNOT resolve their issue, open the support form by responding with a short handoff message and then output:
   [[OPEN_TICKET_FORM]]

═══════════════════════════════════════════════════════════════
EMAIL GATING FOR DISCOUNTS (CRITICAL - FOLLOW THIS EXACTLY):
═══════════════════════════════════════════════════════════════

When a user asks for a discount, coupon, promo code, deal, savings, or any special offer:

1. FIRST check if ANY previous message in this conversation contains an email address (like name@example.com)
2. If NO email has been provided yet in this conversation, you MUST ask for it first:
   "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over 🎁"
3. DO NOT share any coupon codes until the user provides a valid email address
4. ONLY AFTER they provide a valid email (like name@example.com), share the coupon code with full details
5. If they already provided an email earlier in the conversation, you can share the coupon immediately

NEVER share coupon codes without collecting an email first - this is mandatory!

Example flow:
User: "Do you have any discount codes?"
You: "I'd love to share our exclusive discount with you! Just drop your email below and I'll send it right over 🎁"
User: "john@gmail.com"
You: "Thanks! Here's your exclusive code: **PS2026** - 20% off all challenges..."

═══════════════════════════════════════════════════════════════
USER DATA CONTEXT (FROM DATABASE):
═══════════════════════════════════════════════════════════════

{user_data_context}

IMPORTANT - IDENTITY VERIFICATION BEFORE SHARING DATA:
You have the user's full data loaded above, BUT you must NOT share any account-specific details until the user verifies their identity.

REQUIRED VERIFICATION (MANDATORY):
The user MUST provide BOTH of these before you share ANY account/order/credentials data:
  Option A: Email address + Account number (trading account number/login)
  Option B: Email address + Order ID

FLOW:
1. If user asks about "my account", "my status", "my order", "my credentials", etc:
   - First ask: "For security, I'll need to verify your identity. Please provide your **email address** along with either your **trading account number** or **order ID**."
2. Once they provide email + account number OR email + order ID:
   - Cross-check against the loaded data above
   - If the email matches AND the account number or order ID exists in their data → share the relevant info
   - If they don't match → tell them "The details you provided don't match our records. Please double-check and try again."
3. NEVER share account details, credentials, violations, balances, or order info without verification
4. General questions (pricing, how things work, etc.) do NOT require verification

AFTER VERIFICATION - what to show:
- Their active trading accounts with status, balance, and key details
- Any breaches or violations from credentials_reports
- Order history, payout status, etc.
- Be specific: mention account numbers, statuses, dates, amounts from the data
- If a user provides their email but no data is found, let them know we couldn't find an account with that email and ask them to double-check

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
- ONLY tell the user HOW MANY TIMES their account was flagged for martingale and/or averaging. Do NOT over-explain the rules unless they ask.
- Example: "Your account has been flagged **2 times for martingale** and **1 time for averaging**."
- If the user says "but my account is still active" or similar, respond: "When your account comes under review, the risk team will review it sir. The flags are recorded and will be assessed during the review process."
- Do NOT promise any outcome of the review. Just state the flags exist and the risk team handles it.

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

Hey! Great question about payouts. 👋


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
    const { messages, sessionId } = await req.json();

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
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Initialize Supabase client to fetch knowledge base
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch knowledge base, coupons, and MongoDB user context in parallel
    const emails = extractEmailsFromMessages(messages || []);
    const latestEmail = emails.length > 0 ? emails[emails.length - 1] : null;

    const [kbResult, couponsResult, mongoContext] = await Promise.all([
      supabase
        .from("knowledge_base")
        .select("title, content, category")
        .order("category"),
      supabase
        .from("coupons")
        .select("code, discount_type, discount_value, description, benefits, min_purchase, valid_until")
        .eq("is_active", true)
        .or("valid_until.is.null,valid_until.gt." + new Date().toISOString()),
      latestEmail ? fetchMongoUserContext(latestEmail) : Promise.resolve(null),
    ]);

    const { data: knowledgeEntries, error: kbError } = kbResult;
    const { data: coupons, error: couponsError } = couponsResult;

    if (kbError) console.error("Error fetching knowledge base:", kbError);
    if (couponsError) console.error("Error fetching coupons:", couponsError);

    // Format knowledge base for context
    let knowledgeContext = "";
    if (knowledgeEntries && knowledgeEntries.length > 0) {
      knowledgeContext = knowledgeEntries
        .map((entry) => `[${entry.category.toUpperCase()}] ${entry.title}:\n${entry.content}`)
        .join("\n\n---\n\n");
    } else {
      knowledgeContext = "No knowledge base entries available yet. Inform users that the knowledge base is being set up.";
    }

    // Format coupons for context
    let couponsContext = "";
    if (coupons && coupons.length > 0) {
      couponsContext = coupons
        .map((c) => {
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
    if (latestEmail && mongoContext) {
      userDataContext = `Data found for email: ${latestEmail}\n\n${formatUserContext(mongoContext)}`;
      console.log(`MongoDB user context loaded for: ${latestEmail}`);
    } else if (latestEmail && !mongoContext) {
      userDataContext = `Email detected: ${latestEmail}\nNo account found in our database for this email.`;
      console.log(`No MongoDB data found for: ${latestEmail}`);
    }

    const systemPromptWithKnowledge = SYSTEM_PROMPT
      .replace("{knowledge_base}", knowledgeContext)
      .replace("{coupons_context}", couponsContext)
      .replace("{user_data_context}", userDataContext);

    console.log("Sending request to Lovable AI Gateway...");

    // Calculate input tokens (rough estimate: ~4 chars per token)
    const inputText = systemPromptWithKnowledge + messages.map((m: any) => m.content).join(" ");
    const estimatedInputTokens = Math.ceil(inputText.length / 4);

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
          ...messages,
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
