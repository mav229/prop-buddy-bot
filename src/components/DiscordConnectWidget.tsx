import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DiscordConnection {
  discord_username: string;
  assigned_role: string;
  last_synced_at: string;
}

const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

const ROLE_STYLES: Record<string, { color: string; glowColor: string; label: string }> = {
  scholar: {
    color: "239, 68, 68",    // red
    glowColor: "239, 68, 68",
    label: "Scholar",
  },
  examinee: {
    color: "234, 179, 8",    // yellow
    glowColor: "234, 179, 8",
    label: "Examinee",
  },
  student: {
    color: "34, 197, 94",    // green
    glowColor: "34, 197, 94",
    label: "Student",
  },
};

interface DiscordConnectWidgetProps {
  emailOverride?: string;
  minimal?: boolean;
}

export const DiscordConnectWidget = ({ emailOverride, minimal }: DiscordConnectWidgetProps) => {
  const { user } = useAuth();
  const email = emailOverride || user?.email;

  const [connection, setConnection] = useState<DiscordConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (email) checkStatus();
  }, [email]);

  const checkStatus = async () => {
    if (!email) return;
    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "status", email },
      });

      if (error) throw error;
      setConnection(data?.connected ? data.connection : null);
      setError("");
    } catch (err) {
      console.error("Discord status check error:", err);
      setConnection(null);
      setError("Could not verify connection right now. Please try again.");
    } finally {
      setChecked(true);
    }
  };

  const handleConnect = async () => {
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "get_oauth_url", email },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("OAuth URL was not returned");

      const popup = window.open(data.url, "discord-connect", "width=500,height=700");
      if (!popup) {
        setError("Popup was blocked. Please allow popups and try again.");
        setLoading(false);
        return;
      }

      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          setLoading(false);
          checkStatus();
        }
      }, 1000);
    } catch (err) {
      console.error("Discord connect error:", err);
      setError("Failed to connect to Discord. Please try again.");
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!email) return;
    setError("");
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("discord-connect", {
        body: { action: "sync", email },
      });
      if (error) throw error;
      if (data?.success) checkStatus();
    } catch (err) {
      console.error("Discord sync error:", err);
      setError("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  if (!checked || !email) return null;

  const role = connection ? ROLE_STYLES[connection.assigned_role] || ROLE_STYLES.student : null;

  // ── Connected state ──
  if (connection) {
    return (
      <div className="w-full max-w-xs">
        <div className="group relative">
          <div className="absolute -inset-[1px] rounded-[26px] bg-gradient-to-b from-primary/18 via-primary/6 to-transparent opacity-70 blur-sm transition-opacity duration-300 group-hover:opacity-100" />
          <div className="relative overflow-hidden rounded-[24px] border border-border/80 bg-gradient-to-b from-card to-secondary/60 px-4 py-4 shadow-2xl">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-secondary shadow-lg">
                  <DiscordIcon className="h-5 w-5 text-foreground/85" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-background" />
                </span>
              </div>

              <div className="min-w-0 flex-1 text-left">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {connection.discord_username}
                  </span>
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                </div>
                <div className="flex items-center gap-2">
                  {role && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${role.badgeClass}`}
                    >
                      {role.label}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    Connected
                  </span>
                </div>
              </div>

              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/30 text-muted-foreground transition-all duration-200 hover:border-primary/20 hover:bg-secondary hover:text-foreground disabled:opacity-60"
                title="Re-sync role"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span>Role sync available anytime</span>
              <span className="uppercase tracking-[0.18em] text-foreground/55">Live</span>
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  // ── Disconnected state ──
  if (minimal) {
    return (
      <div className="w-full max-w-xs">
        <div className="group relative">
          <div
            className="absolute -inset-px rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
            }}
          />
          <button
            onClick={handleConnect}
            disabled={loading}
            className="relative w-full rounded-2xl px-8 py-4 text-[15px] font-semibold transition-all duration-300"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: loading ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.85)",
              boxShadow: "0 4px 24px -4px rgba(0,0,0,0.4), inset 0 1px 0 0 rgba(255,255,255,0.06)",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting...
              </span>
            ) : (
              "Connect"
            )}
          </button>
        </div>
        {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="w-full max-w-xs">
      <div className="group relative">
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-transparent opacity-0 blur-sm transition-opacity duration-300 group-hover:opacity-100" />
        <button
          onClick={handleConnect}
          disabled={loading}
          className="relative flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg transition-all duration-300 hover:border-primary/20 hover:bg-secondary/80 hover:shadow-xl"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-secondary transition-colors group-hover:bg-secondary/80">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            ) : (
              <DiscordIcon className="h-5 w-5 text-foreground" />
            )}
          </div>
          <div className="text-left">
            <span className="text-sm font-semibold text-foreground">
              {loading ? "Connecting..." : "Connect Discord"}
            </span>
            <p className="text-xs text-muted-foreground">
              Link your account for roles
            </p>
          </div>
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
};
