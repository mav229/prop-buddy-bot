import { useState, useEffect } from "react";
import { Loader2, RefreshCw, Trash2, Users, MessageSquare, Calendar, Edit2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface DiscordUserProfile {
  id: string;
  discord_user_id: string;
  username: string;
  display_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  message_count: number;
  notes: string | null;
}

interface DiscordUserWithMessages extends DiscordUserProfile {
  messages: {
    id: string;
    role: string;
    content: string;
    created_at: string;
  }[];
}

export const DiscordMemoryView = () => {
  const [users, setUsers] = useState<DiscordUserWithMessages[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchDiscordUsers();
  }, []);

  const fetchDiscordUsers = async () => {
    setLoading(true);
    try {
      // Fetch user profiles from discord_users table
      const { data: profiles, error: profilesError } = await supabase
        .from("discord_users")
        .select("*")
        .order("last_seen_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch chat history for all Discord users
      const { data: messages, error: messagesError } = await supabase
        .from("chat_history")
        .select("*")
        .like("session_id", "discord-user-%")
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Group messages by user
      const messagesByUser = new Map<string, typeof messages>();
      (messages || []).forEach((msg) => {
        const discordUserId = msg.session_id.replace("discord-user-", "");
        if (!messagesByUser.has(discordUserId)) {
          messagesByUser.set(discordUserId, []);
        }
        messagesByUser.get(discordUserId)!.push(msg);
      });

      // Combine profiles with their messages
      const usersWithMessages: DiscordUserWithMessages[] = (profiles || []).map((profile) => ({
        ...profile,
        messages: messagesByUser.get(profile.discord_user_id) || [],
      }));

      setUsers(usersWithMessages);
    } catch (err) {
      console.error("Error fetching Discord users:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load Discord user profiles.",
      });
    } finally {
      setLoading(false);
    }
  };

  const clearUserMemory = async (userId: string, discordUserId: string) => {
    try {
      // Delete chat history
      const { error: historyError } = await supabase
        .from("chat_history")
        .delete()
        .eq("session_id", `discord-user-${discordUserId}`);

      if (historyError) throw historyError;

      // Delete user profile
      const { error: profileError } = await supabase
        .from("discord_users")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast({
        title: "Memory cleared",
        description: `Cleared all data for user ${discordUserId.slice(-6)}`,
      });
      
      fetchDiscordUsers();
    } catch (err) {
      console.error("Error clearing memory:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear user memory.",
      });
    }
  };

  const saveNotes = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("discord_users")
        .update({ notes: notesValue || null })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Notes saved",
        description: "User notes have been updated.",
      });

      setEditingNotes(null);
      fetchDiscordUsers();
    } catch (err) {
      console.error("Error saving notes:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save notes.",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
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
            <h2 className="font-display text-xl font-bold">Discord User Profiles</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} users with stored profiles and memory
            </p>
          </div>
        </div>

        <Button variant="ghost" onClick={fetchDiscordUsers}>
          <RefreshCw className="w-4 h-4 mr-2" />
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
            When users interact with the bot on Discord, their profiles and conversation memory will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="glass-panel overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <button
                    onClick={() =>
                      setExpandedUser(
                        expandedUser === user.id ? null : user.id
                      )
                    }
                    className="flex items-start gap-4 flex-1 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-12 h-12 rounded-full bg-[#5865F2]/20 flex items-center justify-center flex-shrink-0">
                      <DiscordIcon className="w-6 h-6 text-[#5865F2]" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {user.username}
                        </span>
                        {user.display_name && user.display_name !== user.username && (
                          <span className="text-sm text-muted-foreground">
                            ({user.display_name})
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs bg-muted/50">
                          ...{user.discord_user_id.slice(-6)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {user.message_count} messages
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          First seen: {formatDate(user.first_seen_at)}
                        </span>
                        <span>
                          Last active: {formatDateTime(user.last_seen_at)}
                        </span>
                      </div>

                      {user.notes && (
                        <div className="mt-2 text-sm text-muted-foreground bg-muted/30 rounded px-2 py-1">
                          📝 {user.notes}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {expandedUser === user.id ? "▼" : "▶"}
                    </div>
                  </button>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingNotes(user.id);
                        setNotesValue(user.notes || "");
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => clearUserMemory(user.id, user.discord_user_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Notes editing */}
                {editingNotes === user.id && (
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg space-y-2">
                    <label className="text-sm font-medium">Notes about this user</label>
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Add notes about this user (e.g., 'Interested in forex trading', 'Prefers quick answers')"
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNotes(null)}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveNotes(user.id)}
                      >
                        <Save className="w-4 h-4 mr-1" />
                        Save Notes
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {expandedUser === user.id && (
                <div className="border-t border-border p-4 space-y-3 bg-muted/20 max-h-96 overflow-y-auto">
                  {user.messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No conversation history yet
                    </p>
                  ) : (
                    user.messages.map((msg) => (
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
                            {msg.role === "user" ? user.username : "Scholaris AI"}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};