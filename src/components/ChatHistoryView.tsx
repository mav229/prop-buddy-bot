import { useState, useEffect } from "react";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatSession {
  session_id: string;
  messages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
  first_message: string;
  last_activity: string;
}

export const ChatHistoryView = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group messages by session
      const sessionMap = new Map<string, ChatSession>();
      
      (data || []).forEach((msg) => {
        if (!sessionMap.has(msg.session_id)) {
          sessionMap.set(msg.session_id, {
            session_id: msg.session_id,
            messages: [],
            first_message: "",
            last_activity: msg.created_at,
          });
        }
        const session = sessionMap.get(msg.session_id)!;
        session.messages.push(msg);
        
        if (msg.role === "user" && !session.first_message) {
          session.first_message = msg.content;
        }
        
        if (new Date(msg.created_at) > new Date(session.last_activity)) {
          session.last_activity = msg.created_at;
        }
      });

      // Sort messages within each session
      sessionMap.forEach((session) => {
        session.messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      setSessions(Array.from(sessionMap.values()));
    } catch (err) {
      console.error("Error fetching sessions:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load chat history.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Chat History</h2>
            <p className="text-sm text-muted-foreground">
              {sessions.length} conversations
            </p>
          </div>
        </div>

        <Button variant="ghost" onClick={fetchSessions}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">
            No conversations yet
          </h3>
          <p className="text-muted-foreground text-sm">
            Chat sessions will appear here once users start using PropScholar AI.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className="glass-panel overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedSession(
                    expandedSession === session.session_id
                      ? null
                      : session.session_id
                  )
                }
                className="w-full p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.first_message || "Empty conversation"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {session.messages.length} messages •{" "}
                      {new Date(session.last_activity).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground ml-4">
                    {expandedSession === session.session_id ? "▼" : "▶"}
                  </div>
                </div>
              </button>

              {expandedSession === session.session_id && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20">
                  {session.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                          msg.role === "user"
                            ? "bg-primary/20 text-foreground"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground mb-1 capitalize">
                          {msg.role}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
