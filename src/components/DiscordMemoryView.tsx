import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Trash2, Users } from "lucide-react";
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

interface DiscordUserMemory {
  userId: string;
  messages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
  messageCount: number;
  lastActivity: string;
}

export const DiscordMemoryView = () => {
  const [users, setUsers] = useState<DiscordUserMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDiscordMemory();
  }, []);

  const fetchDiscordMemory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .like("session_id", "discord-user-%")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by user
      const userMap = new Map<string, DiscordUserMemory>();
      
      (data || []).forEach((msg) => {
        const userId = msg.session_id.replace("discord-user-", "");
        
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            messages: [],
            messageCount: 0,
            lastActivity: msg.created_at,
          });
        }
        
        const user = userMap.get(userId)!;
        user.messages.push(msg);
        user.messageCount++;
        
        if (new Date(msg.created_at) > new Date(user.lastActivity)) {
          user.lastActivity = msg.created_at;
        }
      });

      // Sort messages within each user
      userMap.forEach((user) => {
        user.messages.sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });

      setUsers(Array.from(userMap.values()));
    } catch (err) {
      console.error("Error fetching Discord memory:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load Discord user memory.",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearUserMemory = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("chat_history")
        .delete()
        .eq("session_id", `discord-user-${userId}`);

      if (error) throw error;

      toast({
        title: "Memory cleared",
        description: `Cleared memory for user ${userId.slice(-6)}`,
      });
      
      fetchDiscordMemory();
    } catch (err) {
      console.error("Error clearing memory:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear user memory.",
      });
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
          <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 flex items-center justify-center">
            <DiscordIcon className="w-5 h-5 text-[#5865F2]" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Discord User Memory</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} users with stored memory (up to 20 messages each)
            </p>
          </div>
        </div>

        <Button variant="ghost" onClick={fetchDiscordMemory}>
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">
            No Discord users yet
          </h3>
          <p className="text-muted-foreground text-sm">
            When users interact with the bot on Discord, their conversation memory will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.userId}
              className="glass-panel overflow-hidden"
            >
              <div className="p-4 flex items-center justify-between">
                <button
                  onClick={() =>
                    setExpandedUser(
                      expandedUser === user.userId ? null : user.userId
                    )
                  }
                  className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                >
                  <Badge variant="outline" className="bg-[#5865F2]/10 border-[#5865F2]/30 text-[#5865F2]">
                    <DiscordIcon className="w-3 h-3 mr-1" />
                    User ...{user.userId.slice(-6)}
                  </Badge>
                  
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{user.messageCount} messages</span>
                    <span>•</span>
                    <span>Last active: {new Date(user.lastActivity).toLocaleString()}</span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground ml-auto mr-4">
                    {expandedUser === user.userId ? "▼" : "▶"}
                  </div>
                </button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => clearUserMemory(user.userId)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {expandedUser === user.userId && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20 max-h-96 overflow-y-auto">
                  {user.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                          msg.role === "user"
                            ? "bg-[#5865F2]/20 text-foreground"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        <p className="text-xs text-muted-foreground mb-1 capitalize">
                          {msg.role === "user" ? "Discord User" : "Scholaris AI"}
                        </p>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
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
