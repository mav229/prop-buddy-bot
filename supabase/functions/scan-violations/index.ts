import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== CONSTANTS (from MT5 Strategy Analyzer) =====
const TIME_GAP_LIMIT = 300; // 5 minutes max gap between trades

interface Deal {
  ticket: number;
  position_id: number;
  symbol: string;
  type: number; // 0=BUY, 1=SELL (closing deal type)
  type_name: string;
  price: number;
  volume: number;
  profit: number;
  time: number; // unix timestamp
  time_iso: string;
  entry: number; // 1=OUT
  comment: string;
}

interface Violation {
  type: "MARTINGALE" | "AVERAGING";
  symbol: string;
  prev_deal: { ticket: number; position_id: number; price: number; volume: number; time_iso: string; type_name: string };
  curr_deal: { ticket: number; position_id: number; price: number; volume: number; time_iso: string; type_name: string };
  time_gap_seconds: number;
  reason: string;
}

// ===== VIOLATION DETECTION FROM CLOSE DEALS =====
function detectTradeViolations(deals: Deal[]): Violation[] {
  if (!deals || deals.length < 2) return [];

  // Filter only exit deals (entry=1)
  const exitDeals = deals.filter(d => d.entry === 1 && d.symbol);
  if (exitDeals.length < 2) return [];

  // Group by symbol
  const bySymbol = new Map<string, Deal[]>();
  for (const d of exitDeals) {
    if (!bySymbol.has(d.symbol)) bySymbol.set(d.symbol, []);
    bySymbol.get(d.symbol)!.push(d);
  }

  const violations: Violation[] = [];

  for (const [symbol, symbolDeals] of bySymbol) {
    // Sort by close time
    symbolDeals.sort((a, b) => a.time - b.time);

    for (let i = 1; i < symbolDeals.length; i++) {
      const prev = symbolDeals[i - 1];
      const curr = symbolDeals[i];

      // Skip if different positions closing at same time (partial close of same position)
      if (prev.position_id === curr.position_id) continue;

      // Must be same direction (same closing deal type = same position direction)
      // SELL close = was BUY position, BUY close = was SELL position
      if (prev.type !== curr.type) continue;

      // Time gap between closes
      const timeGap = curr.time - prev.time;
      if (timeGap > TIME_GAP_LIMIT) continue;

      // Drawdown check using close prices
      // For BUY positions (closed by SELL): drawdown if curr close price < prev close price
      // For SELL positions (closed by BUY): drawdown if curr close price > prev close price
      const positionDirection = prev.type === 1 ? "BUY" : "SELL"; // opposite of close type
      let isDrawdown = false;
      if (positionDirection === "BUY" && curr.price < prev.price) isDrawdown = true;
      if (positionDirection === "SELL" && curr.price > prev.price) isDrawdown = true;

      // If no drawdown detected from close prices, skip
      if (!isDrawdown) continue;

      // Classification
      const prevDeal = { ticket: prev.ticket, position_id: prev.position_id, price: prev.price, volume: prev.volume, time_iso: prev.time_iso, type_name: prev.type_name };
      const currDeal = { ticket: curr.ticket, position_id: curr.position_id, price: curr.price, volume: curr.volume, time_iso: curr.time_iso, type_name: curr.type_name };

      if (curr.volume > prev.volume) {
        // MARTINGALE: lot size increased
        const pctIncrease = Math.round(((curr.volume - prev.volume) / prev.volume) * 100);
        violations.push({
          type: "MARTINGALE",
          symbol,
          prev_deal: prevDeal,
          curr_deal: currDeal,
          time_gap_seconds: timeGap,
          reason: `Martingale Breach -- ${positionDirection} ${symbol}: lot increased ${prev.volume} → ${curr.volume} (+${pctIncrease}%) within ${timeGap}s, price in drawdown (${prev.price} → ${curr.price})`,
        });
      } else {
        // AVERAGING: same or lower lot
        violations.push({
          type: "AVERAGING",
          symbol,
          prev_deal: prevDeal,
          curr_deal: currDeal,
          time_gap_seconds: timeGap,
          reason: `Averaging Violation -- ${positionDirection} ${symbol}: same/lower lot (${prev.volume} → ${curr.volume}) within ${timeGap}s during drawdown (${prev.price} → ${curr.price})`,
        });
      }
    }
  }

  return violations;
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const pubKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  if (!authHeader.includes(serviceRoleKey) && !authHeader.includes(anonKey) && !authHeader.includes(pubKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const mongoUri = Deno.env.get("MONGO_URI");
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!mongoUri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey!);
  let client: MongoClient | null = null;
  const batchId = `scan-${Date.now()}`;

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    // Get already-flagged accounts (skip them)
    const { data: flaggedRows } = await supabase.from("flagged_accounts").select("account_number");
    const flaggedSet = new Set((flaggedRows || []).map((r: any) => r.account_number));

    // Get active credentials — only truly active (not breached, not inactive)
    const credDocs = await db.collection("credentialkeys")
      .find({}, { projection: { credentials: 1, name: 1 } })
      .toArray();

    const allActiveLogins: { loginId: number; userName: string; email: string }[] = [];

    for (const doc of credDocs) {
      for (const c of (doc.credentials || [])) {
        // STRICT: only ACTIVE + not breached
        if (c.credentialStatus !== "ACTIVE" || !c.loginId) continue;
        if (c.isBreached === true) continue;
        const loginId = parseInt(c.loginId, 10);
        if (isNaN(loginId) || flaggedSet.has(String(loginId))) continue;
        allActiveLogins.push({
          loginId,
          userName: c.name || c.assignedTo || doc.name || "Unknown",
          email: (c.assignedTo || "").toString(),
        });
      }
    }

    // Also check credentials_reports to exclude breached accounts
    const accountNumbers = allActiveLogins.map(a => a.loginId);
    const breachedReports = await db.collection("credentials_reports")
      .find(
        { account: { $in: accountNumbers }, $or: [{ isBreached: true }, { "breachReasons.0": { $exists: true } }] },
        { projection: { account: 1 } }
      ).toArray();
    const breachedSet = new Set(breachedReports.map((r: any) => r.account));

    const activeAccounts = allActiveLogins.filter(a => !breachedSet.has(a.loginId));

    if (activeAccounts.length === 0) {
      await client.close();
      return new Response(JSON.stringify({ message: "No active accounts to scan", batch: batchId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch trade history from credentials_reports (only tradeHistory.deals + account)
    const activeIds = activeAccounts.map(a => a.loginId);
    const reports = await db.collection("credentials_reports")
      .find({ account: { $in: activeIds } }, {
        projection: { account: 1, "tradeHistory.deals": 1 }
      }).toArray();

    const reportMap = new Map<number, any>();
    for (const r of reports) reportMap.set(r.account, r);

    await client.close();
    client = null;

    // Run trade-level violation detection
    const scanResults: any[] = [];
    let flaggedCount = 0;

    for (const acct of activeAccounts) {
      const report = reportMap.get(acct.loginId);
      const deals: Deal[] = report?.tradeHistory?.deals || [];
      const violations = detectTradeViolations(deals);

      const riskLevel = violations.some(v => v.type === "MARTINGALE") ? "VERY HIGH"
        : violations.some(v => v.type === "AVERAGING") ? "HIGH"
        : "CLEAN";

      if (violations.length > 0) flaggedCount++;

      scanResults.push({
        account_number: String(acct.loginId),
        user_name: acct.userName,
        email: acct.email.includes("@") ? acct.email : null,
        risk_level: riskLevel,
        flags: violations.map(v => ({
          type: v.type,
          severity: v.type === "MARTINGALE" ? "HIGH" : "MEDIUM",
          detail: v.reason,
          symbol: v.symbol,
          prev_deal: v.prev_deal,
          curr_deal: v.curr_deal,
          time_gap_seconds: v.time_gap_seconds,
        })),
        metrics_snapshot: { totalDeals: deals.length, violationCount: violations.length },
        credential_status: "ACTIVE",
        scan_batch_id: batchId,
        scanned_at: new Date().toISOString(),
      });
    }

    // Insert scan results in batches
    for (let i = 0; i < scanResults.length; i += 50) {
      const { error } = await supabase.from("violation_scans").insert(scanResults.slice(i, i + 50));
      if (error) console.error(`[SCAN] Insert error:`, error.message);
    }

    // Auto-flag violated accounts (permanently skip in future scans)
    const flagged = scanResults.filter(r => r.risk_level !== "CLEAN");
    if (flagged.length > 0) {
      const inserts = flagged.map(r => ({
        account_number: r.account_number,
        user_name: r.user_name,
        email: r.email,
        flag_type: r.flags[0]?.type || "UNKNOWN",
        flag_detail: r.flags.map((f: any) => `[${f.severity}] ${f.type}: ${f.detail}`).join(" | "),
        risk_level: r.risk_level,
        metrics_snapshot: r.metrics_snapshot,
      }));
      for (let i = 0; i < inserts.length; i += 50) {
        const { error } = await supabase.from("flagged_accounts").upsert(inserts.slice(i, i + 50), { onConflict: "account_number" });
        if (error) console.error(`[SCAN] Flag error:`, error.message);
      }
    }

    const summary = {
      batch: batchId,
      totalActive: activeAccounts.length,
      scanned: activeAccounts.length,
      flaggedWithViolations: flaggedCount,
      clean: activeAccounts.length - flaggedCount,
      violationTypes: {
        martingale: scanResults.filter(r => r.flags.some((f: any) => f.type === "MARTINGALE")).length,
        averaging: scanResults.filter(r => r.flags.some((f: any) => f.type === "AVERAGING")).length,
      },
    };

    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[SCAN] Error:", error);
    return new Response(JSON.stringify({ error: "Scan failed", detail: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (client) { try { await client.close(); } catch (_) {} }
  }
});
