import { useState, useEffect } from "react";
import { MessageSquarePlus, Search, Trash2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import propscholarIcon from "@/assets/propscholar-icon.png";
import { cn } from "@/lib/utils";


interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
}

interface TicketEntry {
  id: string;
  ticket_number: number;
  status: string;
  created_at: string;
  problem: string;
}

interface ChatSidebarProps {
  currentSessionId: string;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  userEmail?: string;
}

export const ChatSidebar = ({
  currentSessionId,
  onNewChat,
  onSelectSession,
  collapsed,
  onToggle,
  userEmail,
}: ChatSidebarProps) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [tickets, setTickets] = useState<TicketEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    fetchSessions();
    fetchTickets();
  }, [currentSessionId]);

  const fetchSessions = async () => {
    const mySessionIds = JSON.parse(localStorage.getItem("scholaris_sessions") || "[]") as string[];
    if (mySessionIds.length === 0) {
      setSessions([]);
      return;
    }

    const { data: response } = await supabase.functions.invoke("read-chat-history", {
      body: { session_ids: mySessionIds },
    });

    const data = response?.data;
    if (!data) return;

    const userMessages = data.filter((row: any) => row.role === "user");
    const sessionMap = new Map<string, ChatSession>();
    for (const row of userMessages) {
      if (!sessionMap.has(row.session_id)) {
        sessionMap.set(row.session_id, {
          session_id: row.session_id,
          title: row.content.slice(0, 50) + (row.content.length > 50 ? "..." : ""),
          created_at: row.created_at,
        });
      }
    }

    setSessions(Array.from(sessionMap.values()));
  };

  const fetchTickets = async () => {
    // Fetch tickets for this user's sessions
    const mySessionIds = JSON.parse(localStorage.getItem("scholaris_sessions") || "[]") as string[];
    if (mySessionIds.length === 0) return;

    // We query tickets that match any of the user's session IDs
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, status, created_at, problem, session_id")
      .in("session_id", mySessionIds)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) {
      setTickets(
        data.map((t: any) => ({
          id: t.id,
          ticket_number: t.ticket_number,
          status: t.status,
          created_at: t.created_at,
          problem: t.problem,
        }))
      );
    }
  };

  const deleteSession = async (sessionId: string) => {
    const saved = JSON.parse(localStorage.getItem("scholaris_sessions") || "[]") as string[];
    localStorage.setItem("scholaris_sessions", JSON.stringify(saved.filter((id: string) => id !== sessionId)));

    await supabase.from("chat_history").delete().eq("session_id", sessionId);
    await supabase.from("training_feedback").delete().eq("session_id", sessionId);

    setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));

    if (sessionId === currentSessionId) {
      onNewChat();
    }
  };

  const filtered = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-[hsl(38,90%,50%)]";
      case "in_progress": return "bg-[hsl(210,90%,55%)]";
      case "resolved": return "bg-[hsl(142,76%,46%)]";
      default: return "bg-[hsl(0,0%,40%)]";
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center w-14 flex-shrink-0 bg-[hsl(0,0%,4%)] border-r border-[hsl(0,0%,10%)] py-4 gap-3">
        <button onClick={onToggle} className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[hsl(0,0%,10%)] transition-colors">
          <img src={propscholarIcon} alt="S" className="w-6 h-6 rounded-full" />
        </button>
        <button onClick={onNewChat} className="w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,10%)] transition-colors" title="New chat">
          <MessageSquarePlus className="w-4.5 h-4.5" />
        </button>
        <button onClick={() => { onToggle(); setShowSearch(true); }} className="w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(0,0%,45%)] hover:text-[hsl(0,0%,80%)] hover:bg-[hsl(0,0%,10%)] transition-colors" title="Search chats">
          <Search className="w-4.5 h-4.5" />
        </button>
        {tickets.length > 0 && (
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[hsl(0,0%,45%)]" title={`${tickets.length} tickets`}>
            <Ticket className="w-4.5 h-4.5" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 flex-shrink-0 bg-[hsl(0,0%,4%)] border-r border-[hsl(0,0%,10%)] h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button onClick={onToggle} className="flex items-center gap-2.5">
          <img src={propscholarIcon} alt="Scholaris" className="w-7 h-7 rounded-full" />
          <span className="text-[14px] font-semibold text-[hsl(0,0%,85%)] tracking-tight">
            Scholaris AI
          </span>
        </button>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 space-y-0.5">
        <button onClick={onNewChat} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,9%)] transition-colors font-light">
          <MessageSquarePlus className="w-4 h-4" />
          New chat
        </button>
        <button onClick={() => setShowSearch(!showSearch)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-[hsl(0,0%,70%)] hover:text-[hsl(0,0%,90%)] hover:bg-[hsl(0,0%,9%)] transition-colors font-light">
          <Search className="w-4 h-4" />
          Search chats
        </button>
      </div>

      {/* Search input */}
      {showSearch && (
        <div className="px-3 pb-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            autoFocus
            className="w-full bg-[hsl(0,0%,8%)] border border-[hsl(0,0%,14%)] rounded-lg px-3 py-2 text-[12px] text-[hsl(0,0%,80%)] placeholder:text-[hsl(0,0%,30%)] focus:outline-none focus:border-[hsl(0,0%,22%)]"
          />
        </div>
      )}

      {/* Divider */}
      <div className="mx-3 border-t border-[hsl(0,0%,9%)]" />

      {/* Tickets section */}
      {tickets.length > 0 && (
        <div className="px-3 py-3">
          <p className="text-[11px] text-[hsl(0,0%,35%)] font-medium uppercase tracking-wider px-3 mb-2">
            Your Tickets
          </p>
          <div className="space-y-0.5">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-[hsl(0,0%,7%)] transition-colors cursor-default"
              >
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor(ticket.status))} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[hsl(0,0%,70%)] font-mono">
                    Ticket #{ticket.ticket_number}
                  </p>
                  <p className="text-[10px] text-[hsl(0,0%,32%)] truncate font-light">
                    {ticket.problem.slice(0, 40)}{ticket.problem.length > 40 ? "..." : ""}
                  </p>
                </div>
                <span className={cn(
                  "text-[9px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded",
                  ticket.status === "open" && "text-[hsl(38,90%,55%)] bg-[hsl(38,90%,55%,0.1)]",
                  ticket.status === "in_progress" && "text-[hsl(210,90%,60%)] bg-[hsl(210,90%,55%,0.1)]",
                  ticket.status === "resolved" && "text-[hsl(142,76%,50%)] bg-[hsl(142,76%,46%,0.1)]",
                )}>
                  {ticket.status === "in_progress" ? "WIP" : ticket.status}
                </span>
              </div>
            ))}
          </div>
          <div className="mx-3 mt-3 border-t border-[hsl(0,0%,9%)]" />
        </div>
      )}

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-hide">
        <p className="text-[11px] text-[hsl(0,0%,35%)] font-medium uppercase tracking-wider px-3 mb-2">
          Your chats
        </p>
        {filtered.length === 0 ? (
          <p className="text-[12px] text-[hsl(0,0%,25%)] px-3 py-4 font-light">
            {searchQuery ? "No chats found." : "No chat history yet."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((session) => (
              <div
                key={session.session_id}
                className={cn(
                  "group flex items-center rounded-lg transition-colors",
                  session.session_id === currentSessionId
                    ? "bg-[hsl(0,0%,10%)]"
                    : "hover:bg-[hsl(0,0%,7%)]"
                )}
              >
                <button
                  onClick={() => onSelectSession(session.session_id)}
                  className={cn(
                    "flex-1 text-left px-3 py-2.5 text-[13px] font-light truncate",
                    session.session_id === currentSessionId
                      ? "text-[hsl(0,0%,85%)]"
                      : "text-[hsl(0,0%,50%)] hover:text-[hsl(0,0%,75%)]"
                  )}
                >
                  {session.title}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(session.session_id); }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 mr-1.5 rounded text-[hsl(0,0%,40%)] hover:text-red-400 hover:bg-[hsl(0,0%,14%)] transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
