import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Flag {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  detail: string;
}

function detectFlags(report: any, credInfo: any, violations: any[]): Flag[] {
  const flags: Flag[] = [];

  if (credInfo?.isBreached === true || credInfo?.credentialStatus === "BREACHED") {
    flags.push({ type: "BREACHED", severity: "HIGH", detail: `Account breached. Status: ${credInfo.credentialStatus}` });
  }

  const metrics = report?.evaluation?.metrics || {};
  const ddPct = metrics.daily_dd_current_drawdown_pct;
  if (typeof ddPct === "number") {
    const ddLimit = report?.evaluation?.rulesApplied?.daily_loss_limit;
    if (typeof ddLimit === "number" && ddPct > 0) {
      const usedPct = (ddPct / ddLimit) * 100;
      if (usedPct >= 80) {
        flags.push({ type: "HIGH_DRAWDOWN", severity: usedPct >= 95 ? "HIGH" : "MEDIUM", detail: `Daily DD ${ddPct.toFixed(2)}% of ${ddLimit}% (${usedPct.toFixed(0)}% used)` });
      }
    }
  }

  const maxDD = report?.growth?.drawdown;
  if (typeof maxDD === "number") {
    const maxLossLimit = report?.evaluation?.rulesApplied?.max_loss_limit;
    if (typeof maxLossLimit === "number" && maxDD > 0) {
      const usedPct = (maxDD / maxLossLimit) * 100;
      if (usedPct >= 70) {
        flags.push({ type: "MAX_LOSS_PROXIMITY", severity: usedPct >= 90 ? "HIGH" : "MEDIUM", detail: `Max DD ${maxDD.toFixed(2)}% of ${maxLossLimit}% (${usedPct.toFixed(0)}% used)` });
      }
    }
  }

  for (const v of violations) {
    const vType = v.type || v.violationType || "UNKNOWN";
    const vDetail = v.reason || v.description || v.message || JSON.stringify(v).slice(0, 200);
    flags.push({ type: `VIOLATION_${String(vType).toUpperCase()}`, severity: "HIGH", detail: String(vDetail) });
  }

  const profitPct = metrics.profit_percent;
  const profitTarget = report?.evaluation?.rulesApplied?.profit_target;
  if (typeof profitPct === "number" && typeof profitTarget === "number" && profitPct >= profitTarget * 0.9 && profitPct < profitTarget) {
    flags.push({ type: "NEAR_PROFIT_TARGET", severity: "LOW", detail: `Profit ${profitPct.toFixed(2)}% — target ${profitTarget}%` });
  }

  return flags;
}

function calculateRisk(flags: Flag[]): string {
  if (flags.some((f) => f.severity === "HIGH")) return "HIGH";
  if (flags.some((f) => f.severity === "MEDIUM")) return "MEDIUM";
  if (flags.length > 0) return "LOW";
  return "CLEAN";
}

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

    // Get already-flagged accounts from Supabase (skip them)
    const { data: flaggedRows } = await supabase.from("flagged_accounts").select("account_number");
    const flaggedSet = new Set((flaggedRows || []).map((r: any) => r.account_number));

    // Only fetch credentials with ACTIVE status using projection for speed
    const credDocs = await db.collection("credentialkeys")
      .find({}, { projection: { credentials: 1, name: 1 } })
      .toArray();

    const activeAccounts: { loginId: number; userName: string; email: string; credInfo: any }[] = [];

    for (const doc of credDocs) {
      for (const c of (doc.credentials || [])) {
        if (c.credentialStatus !== "ACTIVE" || !c.loginId) continue;
        const loginId = parseInt(c.loginId, 10);
        if (isNaN(loginId) || flaggedSet.has(String(loginId))) continue;
        activeAccounts.push({
          loginId,
          userName: c.name || c.assignedTo || doc.name || "Unknown",
          email: (c.assignedTo || "").toString(),
          credInfo: c,
        });
      }
    }

    if (activeAccounts.length === 0) {
      await client.close();
      return new Response(JSON.stringify({ message: "No active accounts to scan", batch: batchId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const accountNumbers = activeAccounts.map((a) => a.loginId);

    // Fetch reports with projection (only needed fields)
    const reports = await db.collection("credentials_reports")
      .find({ account: { $in: accountNumbers } }, {
        projection: { account: 1, breachReasons: 1, evaluation: 1, growth: 1, equity: 1, balance: 1, longShortIndicators: 1 }
      }).toArray();

    const reportMap = new Map<number, any>();
    for (const r of reports) reportMap.set(r.account, r);

    // Filter out breached
    const clean = activeAccounts.filter((a) => {
      const r = reportMap.get(a.loginId);
      if (!r) return true;
      if (a.credInfo?.isBreached || (r.breachReasons?.length > 0)) return false;
      return true;
    });

    // Fetch violations only for clean accounts
    const cleanIds = clean.map((a) => a.loginId);
    const violationDocs = cleanIds.length > 0 ? await db.collection("violations")
      .find({ $or: [{ account: { $in: cleanIds } }, { accountNumber: { $in: cleanIds } }] }, { projection: { account: 1, accountNumber: 1, type: 1, violationType: 1, reason: 1, description: 1, message: 1 } })
      .limit(300).toArray() : [];

    const violationMap = new Map<number, any[]>();
    for (const v of violationDocs) {
      const acct = v.account || v.accountNumber;
      if (acct) {
        if (!violationMap.has(acct)) violationMap.set(acct, []);
        violationMap.get(acct)!.push(v);
      }
    }

    await client.close();
    client = null;

    // Run detection
    const scanResults: any[] = [];
    let flaggedCount = 0;

    for (const acct of clean) {
      const report = reportMap.get(acct.loginId);
      const flags = detectFlags(report || {}, acct.credInfo, violationMap.get(acct.loginId) || []);
      const riskLevel = calculateRisk(flags);
      if (flags.length > 0) flaggedCount++;

      const metrics = report?.evaluation?.metrics || {};
      scanResults.push({
        account_number: String(acct.loginId),
        user_name: acct.userName,
        email: acct.email.includes("@") ? acct.email : null,
        risk_level: riskLevel,
        flags,
        metrics_snapshot: { equity: report?.equity, balance: report?.balance, profitPercent: metrics.profit_percent, dailyDD: metrics.daily_dd_current_drawdown_pct, maxDrawdown: report?.growth?.drawdown },
        credential_status: acct.credInfo?.credentialStatus || "UNKNOWN",
        scan_batch_id: batchId,
        scanned_at: new Date().toISOString(),
      });
    }

    // Insert scan results
    for (let i = 0; i < scanResults.length; i += 50) {
      const { error } = await supabase.from("violation_scans").insert(scanResults.slice(i, i + 50));
      if (error) console.error(`[SCAN] Insert error:`, error.message);
    }

    // Auto-flag violated accounts
    const flagged = scanResults.filter((r) => r.risk_level !== "CLEAN");
    if (flagged.length > 0) {
      const inserts = flagged.map((r) => ({
        account_number: r.account_number, user_name: r.user_name, email: r.email,
        flag_type: r.flags[0]?.type || "UNKNOWN",
        flag_detail: r.flags.map((f: any) => `[${f.severity}] ${f.type}: ${f.detail}`).join(" | "),
        risk_level: r.risk_level, metrics_snapshot: r.metrics_snapshot,
      }));
      for (let i = 0; i < inserts.length; i += 50) {
        const { error } = await supabase.from("flagged_accounts").upsert(inserts.slice(i, i + 50), { onConflict: "account_number" });
        if (error) console.error(`[SCAN] Flag error:`, error.message);
      }
    }

    const summary = { batch: batchId, totalActive: activeAccounts.length, scanned: clean.length, flagged: flaggedCount, clean: clean.length - flaggedCount };
    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[SCAN] Error:", error);
    return new Response(JSON.stringify({ error: "Scan failed", detail: String(error) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    if (client) { try { await client.close(); } catch (_) {} }
  }
});
