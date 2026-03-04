import { useState, useEffect, useRef } from "react";
import { MessageSquarePlus, Search, Trash2, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import propscholarIcon from "@/assets/propscholar-icon.png";
import { cn } from "@/lib/utils";

interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
  ticketNumber?: number | null;
  ticketStatus?: string | null;
  hasNewMessage?: boolean;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newMsgSessionIds, setNewMsgSessionIds] = useState<Set<string>>(new Set());
  const currentSessionRef = useRef(currentSessionId);
  currentSessionRef.current = currentSessionId;

  useEffect(() => {
    fetchSessions();
  }, [currentSessionId]);

  // Realtime: listen for new messages across all user sessions
  useEffect(() => {
    const mySessionIds = JSON.parse(localStorage.getItem("scholaris_sessions") || "[]") as string[];
    if (mySessionIds.length === 0) return;

    const channel = supabase
      .channel("sidebar-new-msgs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_history" },
        (payload: any) => {
          const row = payload.new;
          if (!row || !mySessionIds.includes(row.session_id)) return;
          // Only flag if it's an agent reply and not the currently viewed session
          if (row.source === "agent" && row.session_id !== currentSessionRef.current) {
            setNewMsgSessionIds((prev) => new Set(prev).add(row.session_id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Clear new message dot when session is selected
  useEffect(() => {
    setNewMsgSessionIds((prev) => {
      if (!prev.has(currentSessionId)) return prev;
      const next = new Set(prev);
      next.delete(currentSessionId);
      return next;
    });
  }, [currentSessionId]);

  const fetchSessions = async () => {
    const mySessionIds = JSON.parse(localStorage.getItem("scholaris_sessions") || "[]") as string[];
    if (mySessionIds.length === 0) {
      setSessions([]);
      return;
    }

    // Fetch chat history and tickets in parallel
    const [chatRes, ticketRes] = await Promise.all([
      supabase.functions.invoke("read-chat-history", {
        body: { session_ids: mySessionIds },
      }),
      supabase
        .from("support_tickets")
        .select("ticket_number, status, session_id")
        .in("session_id", mySessionIds),
    ]);

    const data = chatRes.data?.data;

    // Build ticket map: session_id -> { ticket_number, status }
    const ticketMap = new Map<string, { ticket_number: number; status: string }>();
    if (ticketRes.data) {
      for (const t of ticketRes.data) {
        if (t.session_id) ticketMap.set(t.session_id, { ticket_number: t.ticket_number!, status: t.status });
      }
    }

    if (!data) return;

    const userMessages = data.filter((row: any) => row.role === "user");
    const sessionMap = new Map<string, ChatSession>();
    for (const row of userMessages) {
      if (!sessionMap.has(row.session_id)) {
        const ticket = ticketMap.get(row.session_id);
        sessionMap.set(row.session_id, {
          session_id: row.session_id,
          title: row.content.slice(0, 50) + (row.content.length > 50 ? "..." : ""),
          created_at: row.created_at,
          ticketNumber: ticket?.ticket_number || null,
          ticketStatus: ticket?.status || null,
        });
      }
    }

    setSessions(Array.from(sessionMap.values()));
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
            {filtered.map((session) => {
              const hasNew = newMsgSessionIds.has(session.session_id);
              return (
                <div
                  key={session.session_id}
                  className={cn(
                    "group flex items-center rounded-lg transition-all relative",
                    session.session_id === currentSessionId
                      ? "bg-[hsl(0,0%,10%)]"
                      : "hover:bg-[hsl(0,0%,7%)]",
                    hasNew && "ring-1 ring-white/20 shadow-[0_0_8px_rgba(255,255,255,0.08)]"
                  )}
                >
                  <button
                    onClick={() => onSelectSession(session.session_id)}
                    className={cn(
                      "flex-1 text-left px-3 py-2.5 min-w-0",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {/* New message dot */}
                      {hasNew && (
                        <div className="w-2 h-2 rounded-full bg-white flex-shrink-0 shadow-[0_0_6px_rgba(255,255,255,0.5)]" />
                      )}
                      <span className={cn(
                        "text-[13px] font-light truncate block",
                        session.session_id === currentSessionId
                          ? "text-[hsl(0,0%,85%)]"
                          : hasNew ? "text-white font-normal" : "text-[hsl(0,0%,50%)]"
                      )}>
                        {session.ticketNumber ? `Ticket #${session.ticketNumber}` : session.title}
                      </span>
                    </div>
                    {/* Ticket badge inline */}
                    {session.ticketNumber && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusColor(session.ticketStatus || "open"))} />
                        <span className="text-[10px] font-mono text-[hsl(0,0%,45%)]">
                          Ticket #{session.ticketNumber}
                        </span>
                      </div>
                    )}
                  </button>
                  {/* Hide delete for ticket sessions - only show for non-ticket chats */}
                  {!session.ticketNumber && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.session_id); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 mr-1.5 rounded text-[hsl(0,0%,40%)] hover:text-red-400 hover:bg-[hsl(0,0%,14%)] transition-all"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
