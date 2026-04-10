import { useState, useEffect } from "react";
import {
  Shield, Loader2, RefreshCw, AlertTriangle, CheckCircle2,
  Clock, User, Activity, TrendingDown, ChevronDown, ChevronUp, Mail,
} from "lucide-react";
import { ViolationEmailLogs } from "./ViolationEmailLogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ScanResult {
  id: string;
  account_number: string;
  user_name: string | null;
  email: string | null;
  risk_level: string;
  flags: any;
  metrics_snapshot: any;
  credential_status: string | null;
  scan_batch_id: string;
  scanned_at: string;
}

const riskColors: Record<string, string> = {
  HIGH: "bg-red-500/10 text-red-500 border-red-500/30",
  MEDIUM: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  LOW: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  CLEAN: "bg-green-500/10 text-green-500 border-green-500/30",
};

const riskIcons: Record<string, typeof AlertTriangle> = {
  HIGH: AlertTriangle,
  MEDIUM: TrendingDown,
  LOW: Activity,
  CLEAN: CheckCircle2,
};

export const ViolationScanner = () => {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [showEmailLogs, setShowEmailLogs] = useState(false);

  useEffect(() => {
    fetchLatestScan();
  }, []);

  const fetchLatestScan = async () => {
    setLoading(true);

    // Get the latest batch
    const { data: latestBatch } = await supabase
      .from("violation_scans")
      .select("scan_batch_id, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(1)
      .single();

    if (!latestBatch) {
      setLoading(false);
      return;
    }

    setLastScan(latestBatch.scanned_at);

    const { data } = await supabase
      .from("violation_scans")
      .select("*")
      .eq("scan_batch_id", latestBatch.scan_batch_id)
      .order("risk_level", { ascending: true });

    // Sort: HIGH first, then MEDIUM, LOW, CLEAN
    const riskOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, CLEAN: 3 };
    const sorted = (data || []).sort(
      (a, b) => (riskOrder[a.risk_level] ?? 4) - (riskOrder[b.risk_level] ?? 4)
    );
    setResults(sorted);
    setLoading(false);
  };

  const runManualScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-violations", {
        body: {},
      });
      if (error) throw error;
      toast({
        title: "Scan Complete",
        description: `Scanned ${data?.scanned || 0} accounts, ${data?.flagged || 0} flagged`,
      });
      await fetchLatestScan();
    } catch (err: any) {
      toast({
        title: "Scan Failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    }
    setScanning(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const filtered = filterRisk === "ALL"
    ? results
    : results.filter((r) => r.risk_level === filterRisk);

  const counts = {
    HIGH: results.filter((r) => r.risk_level === "HIGH").length,
    MEDIUM: results.filter((r) => r.risk_level === "MEDIUM").length,
    LOW: results.filter((r) => r.risk_level === "LOW").length,
    CLEAN: results.filter((r) => r.risk_level === "CLEAN").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Violation Scanner
          </h2>
          <p className="text-muted-foreground">
            Auto-scans all active accounts every 2 hours
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastScan && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last: {formatDate(lastScan)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowEmailLogs(!showEmailLogs)}>
            <Mail className="w-4 h-4 mr-1" />
            {showEmailLogs ? "Hide" : "Email"} Logs
          </Button>
          <Button onClick={runManualScan} disabled={scanning} size="sm">
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            {scanning ? "Scanning..." : "Scan Now"}
          </Button>
        </div>
      </div>

      {showEmailLogs && (
        <ViolationEmailLogs onClose={() => setShowEmailLogs(false)} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["HIGH", "MEDIUM", "LOW", "CLEAN"] as const).map((level) => {
          const Icon = riskIcons[level];
          return (
            <Card
              key={level}
              className={`cursor-pointer transition-all ${
                filterRisk === level ? "ring-2 ring-primary" : ""
              } bg-card/50 border-border/50`}
              onClick={() => setFilterRisk(filterRisk === level ? "ALL" : level)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{level}</p>
                  <p className="text-2xl font-bold">{counts[level]}</p>
                </div>
                <Icon className={`w-6 h-6 ${
                  level === "HIGH" ? "text-red-500" :
                  level === "MEDIUM" ? "text-yellow-500" :
                  level === "LOW" ? "text-blue-500" : "text-green-500"
                }`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Results List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>
              {filterRisk === "ALL" ? "All Accounts" : `${filterRisk} Risk`}
              <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
            </span>
            {filterRisk !== "ALL" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterRisk("ALL")}>
                Show All
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{results.length === 0 ? "No scans yet — click Scan Now" : "No accounts match this filter"}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filtered.map((r) => {
                const isExpanded = expandedId === r.id;
                const flags = Array.isArray(r.flags) ? r.flags : [];
                const metrics = r.metrics_snapshot || {};

                return (
                  <div
                    key={r.id}
                    className="rounded-lg border border-border/20 bg-muted/10 overflow-hidden"
                  >
                    <button
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/20 transition"
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {r.user_name || "Unknown"}{" "}
                            <span className="text-xs text-muted-foreground">#{r.account_number}</span>
                          </p>
                          {r.email && (
                            <p className="text-xs text-muted-foreground">{r.email}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={riskColors[r.risk_level] || ""}>
                          {r.risk_level}
                        </Badge>
                        {flags.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {flags.length} flag{flags.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border/20">
                        {/* Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                          {metrics.equity != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Equity:</span>{" "}
                              <span className="font-medium">${Number(metrics.equity).toLocaleString()}</span>
                            </div>
                          )}
                          {metrics.balance != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Balance:</span>{" "}
                              <span className="font-medium">${Number(metrics.balance).toLocaleString()}</span>
                            </div>
                          )}
                          {metrics.profitPercent != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Profit:</span>{" "}
                              <span className="font-medium">{Number(metrics.profitPercent).toFixed(2)}%</span>
                            </div>
                          )}
                          {metrics.dailyDD != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Daily DD:</span>{" "}
                              <span className="font-medium">{Number(metrics.dailyDD).toFixed(2)}%</span>
                            </div>
                          )}
                          {metrics.totalTrades != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Trades:</span>{" "}
                              <span className="font-medium">{metrics.totalTrades}</span>
                            </div>
                          )}
                          {metrics.winTrades != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Wins:</span>{" "}
                              <span className="font-medium">{metrics.winTrades}</span>
                            </div>
                          )}
                          {metrics.maxDrawdown != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Max DD:</span>{" "}
                              <span className="font-medium">{Number(metrics.maxDrawdown).toFixed(2)}%</span>
                            </div>
                          )}
                          {metrics.profitableDays != null && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Profitable Days:</span>{" "}
                              <span className="font-medium">{metrics.profitableDays}</span>
                            </div>
                          )}
                        </div>

                        {/* Flags */}
                        {flags.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">Flags:</p>
                            {flags.map((f: any, i: number) => (
                              <div
                                key={i}
                                className={`text-xs p-2 rounded border ${
                                  f.severity === "HIGH"
                                    ? "bg-red-500/5 border-red-500/20 text-red-400"
                                    : f.severity === "MEDIUM"
                                    ? "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
                                    : "bg-blue-500/5 border-blue-500/20 text-blue-400"
                                }`}
                              >
                                <span className="font-medium">{f.type}</span>: {f.detail}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
