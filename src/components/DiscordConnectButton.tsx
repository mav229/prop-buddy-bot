import { useState, useEffect } from "react";
import { Loader2, CheckCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DiscordConnection {
  discord_username: string;
  assigned_role: string;
  last_synced_at: string;
}

// Discord icon as inline SVG
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
  </svg>
);

const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  student: { bg: "bg-blue-500/10", text: "text-blue-400", label: "Student" },
  examinee: { bg: "bg-amber-500/10", text: "text-amber-400", label: "Examinee" },
  scholar: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Scholar" },
};

export const DiscordConnectButton = ({ email }: { email?: string }) => {
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
      if (!error && data?.connected) {
        setConnection(data.connection);
      }
    } catch (_) {
      // ignore
    } finally {
      setChecked(true);
    }
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
        // Open in new window
        const w = window.open(data.url, "discord-connect", "width=500,height=700");
        // Poll for completion
        const interval = setInterval(() => {
          if (w?.closed) {
            clearInterval(interval);
            setLoading(false);
            checkStatus();
          }
        }, 1000);
      }
    } catch (e) {
      console.error("Connect error:", e);
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
      if (!error && data?.success) {
        checkStatus();
      }
    } catch (_) {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  if (!checked || !email) return null;

  const roleInfo = connection ? ROLE_COLORS[connection.assigned_role] || ROLE_COLORS.student : null;

  if (connection) {
    return (
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(0,0%,7%)] border border-[hsl(0,0%,12%)]">
          <DiscordIcon className="w-4 h-4 text-[#5865F2] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[hsl(0,0%,60%)] truncate">
              {connection.discord_username}
            </p>
            {roleInfo && (
              <span className={`text-[10px] font-medium ${roleInfo.text}`}>
                {roleInfo.label}
              </span>
            )}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="p-1 rounded text-[hsl(0,0%,40%)] hover:text-[hsl(0,0%,70%)] hover:bg-[hsl(0,0%,12%)] transition-colors"
            title="Sync role"
          >
            {syncing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <button
        onClick={handleConnect}
        disabled={loading}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-[#5865F2] hover:bg-[#5865F2]/10 border border-[hsl(0,0%,12%)] hover:border-[#5865F2]/30 transition-all font-light"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <DiscordIcon className="w-4 h-4" />
        )}
        {loading ? "Connecting..." : "Connect Discord"}
      </button>
    </div>
  );
};
