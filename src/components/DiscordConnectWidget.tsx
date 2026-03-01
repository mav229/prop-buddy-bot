import { useState, useEffect } from "react";
import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DiscordConnection {
  discord_username: string;
  assigned_role: string;
  last_synced_at: string;
}

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
  </svg>
);

const ROLE_STYLES: Record<string, { color: string; label: string }> = {
  scholar:  { color: "text-emerald-400", label: "Scholar" },
  examinee: { color: "text-amber-400",   label: "Examinee" },
  student:  { color: "text-blue-400",    label: "Student" },
};

export const DiscordConnectWidget = () => {
  const { user } = useAuth();
  const email = user?.email;

  const [connection, setConnection] = useState<DiscordConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (email) checkStatus();
  }, [email]);

  const checkStatus = async () => {
    if (!email) return;
    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "status", email },
      });
      if (!error && data?.connected) setConnection(data.connection);
    } catch (_) {}
    finally { setChecked(true); }
  };

  const handleConnect = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "get_oauth_url", email },
      });
      if (error) throw error;
      if (data?.url) {
        const w = window.open(data.url, "discord-connect", "width=500,height=700");
        const interval = setInterval(() => {
          if (w?.closed) {
            clearInterval(interval);
            setLoading(false);
            checkStatus();
          }
        }, 1000);
      }
    } catch (e) {
      console.error("Discord connect error:", e);
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!email) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "sync", email },
      });
      if (!error && data?.success) checkStatus();
    } catch (_) {}
    finally { setSyncing(false); }
  };

  if (!checked || !email) return null;

  const role = connection ? ROLE_STYLES[connection.assigned_role] || ROLE_STYLES.student : null;

  // ── Connected state ──
  if (connection) {
    return (
      <div className="group relative w-full max-w-xs">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#5865F2]/40 via-emerald-500/30 to-[#5865F2]/40 opacity-60 blur-sm group-hover:opacity-80 transition-opacity" />
        <div className="relative flex items-center gap-3 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] px-4 py-3 shadow-xl">
          {/* Discord avatar area */}
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
              <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[hsl(var(--card))]">
              <span className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-40" />
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[hsl(var(--foreground))] truncate">
                {connection.discord_username}
              </span>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            </div>
            {role && (
              <span className={`text-xs font-medium ${role.color}`}>
                {role.label}
              </span>
            )}
          </div>

          {/* Sync */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-2 rounded-lg text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-colors"
            title="Re-sync role"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Disconnected state ──
  return (
    <div className="group relative w-full max-w-xs">
      <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#5865F2]/50 to-[#5865F2]/30 opacity-0 group-hover:opacity-70 blur-sm transition-opacity duration-300" />
      <button
        onClick={handleConnect}
        disabled={loading}
        className="relative w-full flex items-center gap-3 rounded-2xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[#5865F2]/40 px-4 py-3 shadow-lg hover:shadow-xl transition-all duration-300"
      >
        <div className="w-10 h-10 rounded-full bg-[#5865F2]/15 flex items-center justify-center group-hover:bg-[#5865F2]/25 transition-colors">
          {loading ? (
            <Loader2 className="w-5 h-5 text-[#5865F2] animate-spin" />
          ) : (
            <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
          )}
        </div>
        <div className="text-left">
          <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
            {loading ? "Connecting..." : "Connect Discord"}
          </span>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Link your account for roles
          </p>
        </div>
      </button>
    </div>
  );
};
