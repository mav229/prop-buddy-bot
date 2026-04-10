import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Mail, Loader2, X } from "lucide-react";

interface FlaggedEmailLog {
  id: string;
  account_number: string;
  user_name: string | null;
  email: string | null;
  flag_type: string;
  risk_level: string;
  flagged_at: string;
  emailed_at: string | null;
}

interface Props {
  onClose: () => void;
}

export const ViolationEmailLogs = ({ onClose }: Props) => {
  const [logs, setLogs] = useState<FlaggedEmailLog[]>([]);
  const [filtered, setFiltered] = useState<FlaggedEmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("flagged_accounts")
        .select("id, account_number, user_name, email, flag_type, risk_level, flagged_at, emailed_at")
        .order("flagged_at", { ascending: false });

      if (error) throw error;
      setLogs((data as FlaggedEmailLog[]) || []);
      setFiltered((data as FlaggedEmailLog[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch violation email logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(logs);
    } else {
      const q = search.toLowerCase();
      setFiltered(logs.filter(l =>
        l.account_number.toLowerCase().includes(q) ||
        (l.user_name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        l.flag_type.toLowerCase().includes(q)
      ));
    }
  }, [search, logs]);

  const stats = {
    total: logs.length,
    emailed: logs.filter(l => l.emailed_at).length,
    pending: logs.filter(l => !l.emailed_at).length,
    martingale: logs.filter(l => l.flag_type === "MARTINGALE").length,
    averaging: logs.filter(l => l.flag_type === "AVERAGING").length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Violation Email Logs
          </h3>
          <p className="text-sm text-muted-foreground">Track which flagged accounts have been emailed</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3 text-center">
          <div className="text-xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Flagged</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-green-500">{stats.emailed}</div>
          <div className="text-xs text-muted-foreground">Emailed</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-yellow-500">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-red-500">{stats.martingale}</div>
          <div className="text-xs text-muted-foreground">Martingale</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-xl font-bold text-orange-500">{stats.averaging}</div>
          <div className="text-xs text-muted-foreground">Averaging</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by account, name, email, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {logs.length} flagged accounts
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No flagged accounts yet</Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((log) => (
            <Card key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  #{log.account_number} — {log.user_name || "Unknown"}
                </div>
                {log.email && (
                  <div className="text-sm text-muted-foreground truncate">{log.email}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{log.flag_type}</Badge>
                  <Badge
                    variant={log.risk_level === "VERY HIGH" ? "destructive" : "default"}
                    className="text-xs"
                  >
                    {log.risk_level}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Mail className={`w-4 h-4 ${log.emailed_at ? "text-green-500" : "text-muted-foreground/30"}`} />
                  <span className={`text-xs ${log.emailed_at ? "text-green-500 font-medium" : "text-muted-foreground/40"}`}>
                    {log.emailed_at ? "Sent" : "Not sent"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right min-w-[80px]">
                  {log.emailed_at ? (
                    <>
                      {new Date(log.emailed_at).toLocaleDateString()}<br />
                      {new Date(log.emailed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  ) : (
                    <>
                      Flagged: {new Date(log.flagged_at).toLocaleDateString()}
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
