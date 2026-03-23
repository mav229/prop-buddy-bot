import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle, XCircle, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ConnectionLog {
  id: string;
  email: string;
  discord_username: string | null;
  discord_user_id: string | null;
  action: string;
  status: string;
  assigned_role: string | null;
  error_message: string | null;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  scholar: "text-red-400 bg-red-500/10 border-red-500/20",
  examinee: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  student: "text-green-400 bg-green-500/10 border-green-500/20",
};

export const ConnectionLogsView = () => {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("discord_connection_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      setLogs(data as ConnectionLog[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Connection Logs</h2>
          <p className="text-muted-foreground text-sm">Track all Discord connection attempts</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="border border-border/50 rounded-xl bg-card/30 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            No connection logs yet
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Discord User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {log.email}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.discord_username || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.status === "success" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.assigned_role ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${ROLE_COLORS[log.assigned_role] || "text-muted-foreground"}`}>
                        {log.assigned_role.charAt(0).toUpperCase() + log.assigned_role.slice(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {log.error_message || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
