import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Search, Mail, Eye, MousePointerClick, Loader2 } from "lucide-react";

interface EmailLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  template_id: string;
  tracking_id: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  source: string;
}

export const EmailLogsView = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [filtered, setFiltered] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs((data as EmailLog[]) || []);
      setFiltered((data as EmailLog[]) || []);
    } catch (err: any) {
      console.error("Failed to fetch email logs:", err);
      toast.error("Failed to load email logs");
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
        l.recipient_email.toLowerCase().includes(q) ||
        (l.recipient_name || "").toLowerCase().includes(q) ||
        l.template_id.toLowerCase().includes(q)
      ));
    }
  }, [search, logs]);

  const stats = {
    total: logs.length,
    opened: logs.filter(l => l.opened_at).length,
    clicked: logs.filter(l => l.clicked_at).length,
    auto: logs.filter(l => l.source === "auto_cart_2hr").length,
    manual: logs.filter(l => l.source === "manual").length,
  };

  const openRate = stats.total > 0 ? Math.round((stats.opened / stats.total) * 100) : 0;
  const clickRate = stats.total > 0 ? Math.round((stats.clicked / stats.total) * 100) : 0;

  const templateNames: Record<string, string> = {
    "friendly-nudge": "Friendly Nudge",
    "bold-direct": "Bold & Direct",
    "smooth-closer": "Smooth Closer",
    "hype-king": "Hype King",
    "chill-vibes": "Chill Vibes",
    manual: "Manual",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6" />
            Email Logs
          </h2>
          <p className="text-muted-foreground">Track opens, clicks, and delivery for all sent emails</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Sent</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-500">{stats.opened}</div>
          <div className="text-xs text-muted-foreground">Opened ({openRate}%)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-500">{stats.clicked}</div>
          <div className="text-xs text-muted-foreground">Clicked ({clickRate}%)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.auto}</div>
          <div className="text-xs text-muted-foreground">Auto (2hr)</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{stats.manual}</div>
          <div className="text-xs text-muted-foreground">Manual</div>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email, name, or template..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {logs.length} emails
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No email logs yet</Card>
      ) : (
        <div className="grid gap-2">
          {filtered.map((log) => (
            <Card key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{log.recipient_name || log.recipient_email}</div>
                {log.recipient_name && (
                  <div className="text-sm text-muted-foreground truncate">{log.recipient_email}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {templateNames[log.template_id] || log.template_id}
                  </Badge>
                  <Badge variant={log.source === "auto_cart_2hr" ? "default" : "secondary"} className="text-xs">
                    {log.source === "auto_cart_2hr" ? "Auto" : "Manual"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5" title={log.opened_at ? `Opened: ${new Date(log.opened_at).toLocaleString()}` : "Not opened"}>
                  <Eye className={`w-4 h-4 ${log.opened_at ? "text-blue-500" : "text-muted-foreground/30"}`} />
                  <span className={`text-xs ${log.opened_at ? "text-blue-500 font-medium" : "text-muted-foreground/40"}`}>
                    {log.opened_at ? "Opened" : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" title={log.clicked_at ? `Clicked: ${new Date(log.clicked_at).toLocaleString()}` : "Not clicked"}>
                  <MousePointerClick className={`w-4 h-4 ${log.clicked_at ? "text-green-500" : "text-muted-foreground/30"}`} />
                  <span className={`text-xs ${log.clicked_at ? "text-green-500 font-medium" : "text-muted-foreground/40"}`}>
                    {log.clicked_at ? "Clicked" : "—"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground text-right min-w-[80px]">
                  {new Date(log.sent_at).toLocaleDateString()}<br />
                  {new Date(log.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
