import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Mail, Clock, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionLog {
  sessionId: string;
  email: string | null;
  firstMessage: string;
  messageCount: number;
  userMessages: string[];
  startedAt: string;
  lastActive: string;
}

export const FullpageUsageLogs = () => {
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch recent chat history (last 500 messages to group into sessions)
      const { data: chatData, error: chatErr } = await supabase
        .from("chat_history")
        .select("session_id, role, content, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (chatErr) throw chatErr;

      // Fetch all leads to map session_id → email
      const { data: leadsData } = await supabase
        .from("widget_leads")
        .select("session_id, email");

      const emailMap = new Map<string, string>();
      (leadsData || []).forEach((l) => {
        if (l.session_id) emailMap.set(l.session_id, l.email);
      });

      // Also extract emails from user messages per session
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

      // Group by session
      const sessionMap = new Map<string, { messages: typeof chatData }>();
      (chatData || []).forEach((row) => {
        if (!sessionMap.has(row.session_id)) {
          sessionMap.set(row.session_id, { messages: [] });
        }
        sessionMap.get(row.session_id)!.messages.push(row);
      });

      const sessionLogs: SessionLog[] = [];
      sessionMap.forEach((data, sessionId) => {
        const msgs = data.messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const userMsgs = msgs.filter((m) => m.role === "user");
        if (userMsgs.length === 0) return;

        // Try to find email: from leads table, or from message content
        let email = emailMap.get(sessionId) || null;
        if (!email) {
          for (const m of userMsgs) {
            const match = m.content.match(emailRegex);
            if (match) {
              email = match[0];
              break;
            }
          }
        }

        sessionLogs.push({
          sessionId,
          email,
          firstMessage: userMsgs[0]?.content || "",
          messageCount: msgs.length,
          userMessages: userMsgs.map((m) => m.content),
          startedAt: msgs[0]?.created_at || "",
          lastActive: msgs[msgs.length - 1]?.created_at || "",
        });
      });

      // Sort by most recent first
      sessionLogs.sort(
        (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
      );

      setLogs(sessionLogs);
    } catch (err) {
      console.error("Error fetching usage logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTime = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const truncate = (s: string, len = 80) =>
    s.length > len ? s.slice(0, len) + "..." : s;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Usage Logs</h3>
          <p className="text-sm text-muted-foreground">
            {logs.length} session{logs.length !== 1 ? "s" : ""} found
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-1.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading && logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading sessions...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No chat sessions found yet.</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const isExpanded = expandedSession === log.sessionId;
            return (
              <div
                key={log.sessionId}
                className="border border-border/50 rounded-xl bg-card/30 overflow-hidden transition-colors hover:bg-card/50"
              >
                <button
                  onClick={() => setExpandedSession(isExpanded ? null : log.sessionId)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {log.email ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          <Mail className="w-3 h-3" />
                          {log.email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 bg-muted/30 px-2 py-0.5 rounded-full">
                          Anonymous
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3 h-3" />
                        {log.messageCount} msgs
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.lastActive)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/80 truncate">
                      {truncate(log.firstMessage)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border/30 pt-3">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">
                      Questions asked ({log.userMessages.length}):
                    </p>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {log.userMessages.map((msg, i) => (
                        <div
                          key={i}
                          className="text-sm text-foreground/70 bg-muted/20 rounded-lg px-3 py-2"
                        >
                          {msg}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/50 mt-2">
                      Session: {log.sessionId.slice(0, 8)}...
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
