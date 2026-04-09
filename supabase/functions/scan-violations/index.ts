import { MongoClient } from "npm:mongodb@6.12.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Flag {
  type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  detail: string;
}

function detectFlags(report: any, credDoc: any, credInfo: any, violations: any[]): Flag[] {
  const flags: Flag[] = [];

  // 1. Check breach status from credentialkeys
  if (credInfo?.isBreached === true || credInfo?.credentialStatus === "BREACHED") {
    flags.push({
      type: "BREACHED",
      severity: "HIGH",
      detail: `Account breached. Status: ${credInfo.credentialStatus}`,
    });
  }

  // 2. Check breach reasons from credentials_reports
  const breachReasons = report?.breachReasons || [];
  if (Array.isArray(breachReasons) && breachReasons.length > 0) {
    for (const reason of breachReasons) {
      const reasonStr = typeof reason === "string" ? reason : JSON.stringify(reason);
      flags.push({
        type: "BREACH_FLAG",
        severity: credInfo?.credentialStatus === "BREACHED" ? "HIGH" : "MEDIUM",
        detail: reasonStr,
      });
    }
  }

  // 3. Check drawdown levels
  const metrics = report?.evaluation?.metrics || {};
  const ddPct = metrics.daily_dd_current_drawdown_pct;
  if (typeof ddPct === "number") {
    const rules = report?.evaluation?.rulesApplied || {};
    const ddLimit = rules.daily_loss_limit;
    if (typeof ddLimit === "number" && ddPct > 0) {
      const usedPct = (ddPct / ddLimit) * 100;
      if (usedPct >= 80) {
        flags.push({
          type: "HIGH_DRAWDOWN",
          severity: usedPct >= 95 ? "HIGH" : "MEDIUM",
          detail: `Daily DD at ${ddPct.toFixed(2)}% of ${ddLimit}% limit (${usedPct.toFixed(0)}% used)`,
        });
      }
    }
  }

  // 4. Check max loss proximity
  const growth = report?.growth || {};
  const maxDD = growth?.drawdown;
  if (typeof maxDD === "number") {
    const maxLossLimit = report?.evaluation?.rulesApplied?.max_loss_limit;
    if (typeof maxLossLimit === "number" && maxDD > 0) {
      const usedPct = (maxDD / maxLossLimit) * 100;
      if (usedPct >= 70) {
        flags.push({
          type: "MAX_LOSS_PROXIMITY",
          severity: usedPct >= 90 ? "HIGH" : "MEDIUM",
          detail: `Max drawdown at ${maxDD.toFixed(2)}% of ${maxLossLimit}% limit (${usedPct.toFixed(0)}% used)`,
        });
      }
    }
  }

  // 5. Check existing violations from violations collection
  if (violations.length > 0) {
    for (const v of violations) {
      const vType = v.type || v.violationType || "UNKNOWN";
      const vDetail = v.reason || v.description || v.message || JSON.stringify(v).slice(0, 200);
      flags.push({
        type: `VIOLATION_${String(vType).toUpperCase()}`,
        severity: "HIGH",
        detail: String(vDetail),
      });
    }
  }

  // 6. Profit target check
  const profitPct = metrics.profit_percent;
  const profitTarget = report?.evaluation?.rulesApplied?.profit_target;
  if (typeof profitPct === "number" && typeof profitTarget === "number") {
    if (profitPct >= profitTarget * 0.9 && profitPct < profitTarget) {
      flags.push({
        type: "NEAR_PROFIT_TARGET",
        severity: "LOW",
        detail: `Profit at ${profitPct.toFixed(2)}% — target is ${profitTarget}%`,
      });
    }
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  // Allow service role, anon key, or publishable key (for cron)
  const isAuthorized =
    authHeader.includes(serviceRoleKey) ||
    authHeader.includes(anonKey) ||
    authHeader.includes(supabaseAnonKey);

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const mongoUri = Deno.env.get("MONGO_URI");
  const dbName = Deno.env.get("MONGO_DB_NAME") || "test";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!mongoUri) {
    return new Response(JSON.stringify({ error: "MONGO_URI not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey!);
  let client: MongoClient | null = null;
  const batchId = `scan-${Date.now()}`;

  try {
    client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db(dbName);

    console.log(`[SCAN] Starting violation scan batch: ${batchId}`);

    // 1. Get all credentialkeys docs with ACTIVE credentials
    const credDocs = await db
      .collection("credentialkeys")
      .find({})
      .limit(500)
      .toArray();

    // Extract all active credentials with their account numbers
    const activeAccounts: {
      loginId: number;
      userName: string;
      email: string;
      credInfo: any;
    }[] = [];

    for (const doc of credDocs) {
      const creds = doc.credentials || [];
      for (const c of creds) {
        if (c.credentialStatus === "ACTIVE" && c.loginId) {
          const loginId = parseInt(c.loginId, 10);
          if (!isNaN(loginId)) {
            activeAccounts.push({
              loginId,
              userName: c.name || c.assignedTo || doc.name || "Unknown",
              email: (c.assignedTo || "").toString(),
              credInfo: c,
            });
          }
        }
      }
    }

    console.log(`[SCAN] Found ${activeAccounts.length} active accounts`);

    if (activeAccounts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active accounts found", batch: batchId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch credentials_reports for all active accounts
    const accountNumbers = activeAccounts.map((a) => a.loginId);
    const reports = await db
      .collection("credentials_reports")
      .find({ account: { $in: accountNumbers } })
      .toArray();

    const reportMap = new Map<number, any>();
    for (const r of reports) {
      reportMap.set(r.account, r);
    }

    // 3. Fetch violations for these accounts
    const violationDocs = await db
      .collection("violations")
      .find({
        $or: [
          { account: { $in: accountNumbers } },
          { accountNumber: { $in: accountNumbers } },
          { loginId: { $in: accountNumbers.map(String) } },
        ],
      })
      .limit(500)
      .toArray();

    const violationMap = new Map<number, any[]>();
    for (const v of violationDocs) {
      const acct = v.account || v.accountNumber || parseInt(v.loginId, 10);
      if (acct) {
        if (!violationMap.has(acct)) violationMap.set(acct, []);
        violationMap.get(acct)!.push(v);
      }
    }

    // 4. Filter out accounts that already have breachReasons (not truly active)
    const trulyActiveAccounts = activeAccounts.filter((acct) => {
      const report = reportMap.get(acct.loginId);
      if (!report) return true; // No report = still active, include it
      const breachReasons = report?.breachReasons || [];
      const isBreached = acct.credInfo?.isBreached === true;
      // Skip if has breach reasons or is explicitly breached
      if ((Array.isArray(breachReasons) && breachReasons.length > 0) || isBreached) {
        return false;
      }
      return true;
    });

    console.log(`[SCAN] Truly active (no breach reasons): ${trulyActiveAccounts.length} of ${activeAccounts.length}`);

    // 5. Run detection for each truly active account
    const scanResults: any[] = [];
    let flaggedCount = 0;

    for (const acct of trulyActiveAccounts) {
      const report = reportMap.get(acct.loginId);
      const violations = violationMap.get(acct.loginId) || [];
      const flags = detectFlags(report || {}, null, acct.credInfo, violations);
      const riskLevel = calculateRisk(flags);

      if (flags.length > 0) flaggedCount++;

      const metrics = report?.evaluation?.metrics || {};
      const snapshot: any = {
        equity: report?.equity,
        balance: report?.balance,
        profitPercent: metrics.profit_percent,
        dailyDD: metrics.daily_dd_current_drawdown_pct,
        profitableDays: metrics.profitable_days,
        totalTrades: report?.longShortIndicators?.trades,
        winTrades: report?.longShortIndicators?.win_trades,
        maxDrawdown: report?.growth?.drawdown,
      };

      scanResults.push({
        account_number: String(acct.loginId),
        user_name: acct.userName,
        email: acct.email.includes("@") ? acct.email : null,
        risk_level: riskLevel,
        flags,
        metrics_snapshot: snapshot,
        credential_status: acct.credInfo?.credentialStatus || "UNKNOWN",
        scan_batch_id: batchId,
        scanned_at: new Date().toISOString(),
      });
    }

    // 5. Insert results into Supabase
    if (scanResults.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < scanResults.length; i += 50) {
        const batch = scanResults.slice(i, i + 50);
        const { error } = await supabase.from("violation_scans").insert(batch);
        if (error) {
          console.error(`[SCAN] Insert error batch ${i}:`, error.message);
        }
      }
    }

    const summary = {
      batch: batchId,
      totalCredentialActive: activeAccounts.length,
      trulyActive: trulyActiveAccounts.length,
      skippedBreached: activeAccounts.length - trulyActiveAccounts.length,
      scanned: scanResults.length,
      flagged: flaggedCount,
      clean: scanResults.length - flaggedCount,
      riskBreakdown: {
        HIGH: scanResults.filter((r) => r.risk_level === "HIGH").length,
        MEDIUM: scanResults.filter((r) => r.risk_level === "MEDIUM").length,
        LOW: scanResults.filter((r) => r.risk_level === "LOW").length,
        CLEAN: scanResults.filter((r) => r.risk_level === "CLEAN").length,
      },
    };

    console.log(`[SCAN] Complete:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCAN] Error:", error);
    return new Response(
      JSON.stringify({ error: "Scan failed", detail: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    if (client) {
      try { await client.close(); } catch (_) {}
    }
  }
});
