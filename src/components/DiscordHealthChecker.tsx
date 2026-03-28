import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Loader2, ShieldCheck, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RoleResult {
  configured: boolean;
  roleId: string | null;
  valid: boolean;
  roleName: string | null;
  error: string | null;
}

interface HealthData {
  bot_token_valid: boolean;
  guild_valid: boolean;
  guild_id: string;
  roles: Record<string, RoleResult>;
  connection_counts: Record<string, number>;
  total_connections: number;
}

const ROLE_STYLES: Record<string, { border: string; text: string; bg: string }> = {
  student: { border: "border-green-500/30", text: "text-green-400", bg: "bg-green-500/10" },
  examinee: { border: "border-yellow-500/30", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  scholar: { border: "border-red-500/30", text: "text-red-400", bg: "bg-red-500/10" },
};

export const DiscordHealthChecker = () => {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke("discord-connect", {
        body: { action: "health_check" },
      });
      if (err) throw err;
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  };

  const StatusDot = ({ ok }: { ok: boolean }) => (
    ok
      ? <CheckCircle className="w-4 h-4 text-green-400" />
      : <XCircle className="w-4 h-4 text-red-400" />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-semibold text-lg">Discord Health Check</h3>
        </div>
        <Button variant="outline" size="sm" onClick={runCheck} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
          {loading ? "Checking..." : "Run Check"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {/* System Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-card/30 p-3 flex items-center gap-3">
              <StatusDot ok={data.bot_token_valid} />
              <div>
                <p className="text-sm font-medium">Bot Token</p>
                <p className="text-xs text-muted-foreground">{data.bot_token_valid ? "Authenticated" : "Invalid"}</p>
              </div>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/30 p-3 flex items-center gap-3">
              <StatusDot ok={data.guild_valid} />
              <div>
                <p className="text-sm font-medium">Guild Access</p>
                <p className="text-xs text-muted-foreground">{data.guild_valid ? "Connected" : "Cannot access"}</p>
              </div>
            </div>
          </div>

          {/* Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["student", "examinee", "scholar"] as const).map((role) => {
              const r = data.roles[role];
              const style = ROLE_STYLES[role];
              const count = data.connection_counts[role] || 0;
              if (!r) return null;

              return (
                <div key={role} className={`rounded-xl border ${style.border} ${style.bg} p-4 space-y-3`}>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold text-sm uppercase tracking-wider ${style.text}`}>
                      {role}
                    </span>
                    <StatusDot ok={r.configured && r.valid} />
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Configured</span>
                      <span className={r.configured ? "text-green-400" : "text-red-400"}>
                        {r.configured ? "Yes" : "No"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valid in Guild</span>
                      <span className={r.valid ? "text-green-400" : "text-red-400"}>
                        {r.valid ? "Yes" : "No"}
                      </span>
                    </div>
                    {r.roleName && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Discord Name</span>
                        <span className="text-foreground font-medium">{r.roleName}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Users</span>
                      <span className="text-foreground font-mono">{count}</span>
                    </div>
                    {r.roleId && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ID</span>
                        <span className="text-muted-foreground font-mono text-[10px]">{r.roleId}</span>
                      </div>
                    )}
                  </div>

                  {r.error && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 rounded px-2 py-1 break-all">
                      {r.error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground text-center pt-2">
            Total connections: <span className="font-mono text-foreground">{data.total_connections}</span>
          </div>
        </div>
      )}
    </div>
  );
};
