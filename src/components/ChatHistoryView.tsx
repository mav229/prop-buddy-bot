import { useState, useEffect } from "react";
import { MessageSquare, Loader2, RefreshCw, Users, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

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
  source: "discord" | "web";
  userId?: string;
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
          const isDiscord = msg.session_id.startsWith("discord-user-");
          const userId = isDiscord ? msg.session_id.replace("discord-user-", "") : undefined;
          
          sessionMap.set(msg.session_id, {
            session_id: msg.session_id,
            messages: [],
            first_message: "",
            last_activity: msg.created_at,
            source: isDiscord ? "discord" : "web",
            userId,
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
              {sessions.length} conversations • {sessions.filter(s => s.source === "discord").length} Discord users
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <DiscordIcon className="w-3.5 h-3.5 text-[#5865F2]" />
              <span>Discord</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>Web</span>
            </div>
          </div>

          <Button variant="ghost" onClick={fetchSessions}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {session.source === "discord" ? (
                      <Badge variant="outline" className="shrink-0 bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]">
                        <DiscordIcon className="w-3 h-3 mr-1" />
                        Discord
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 bg-primary/10 border-primary/30 text-primary">
                        <Globe className="w-3 h-3 mr-1" />
                        Web
                      </Badge>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {session.source === "discord" && session.userId 
                          ? `User ${session.userId.slice(-6)}` 
                          : session.first_message || "Empty conversation"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {session.first_message && session.source === "discord" 
                          ? session.first_message.slice(0, 50) + (session.first_message.length > 50 ? "..." : "")
                          : `${session.messages.length} messages`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <p className="text-xs text-muted-foreground">
                      {session.messages.length} msgs • {new Date(session.last_activity).toLocaleDateString()}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      {expandedSession === session.session_id ? "▼" : "▶"}
                    </div>
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
