import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Ticket, RefreshCw, Mail, Phone, MessageSquare, Clock, CheckCircle,
  AlertCircle, Trash2, ExternalLink, Copy, Filter, Search
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface SupportTicket {
  id: string;
  email: string;
  phone: string;
  problem: string;
  status: string;
  source: string;
  session_id: string | null;
  chat_history: string | null;
  created_at: string;
  updated_at: string;
}

export const TicketsManager = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [search, setSearch] = useState("");

  const fetchTickets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Failed to load tickets");
    } else {
      setTickets(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchTickets(); }, []);

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);

    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(`Ticket → ${newStatus}`);
      fetchTickets();
    }
  };

  const deleteTicket = async (ticketId: string) => {
    if (!confirm("Delete this ticket permanently?")) return;
    const { error } = await supabase
      .from("support_tickets")
      .delete()
      .eq("id", ticketId);

    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Ticket deleted");
      fetchTickets();
    }
  };

  const copyTicketLink = (ticketId: string) => {
    const url = `${window.location.origin}/ticket/${ticketId}`;
    navigator.clipboard.writeText(url);
    toast.success("Ticket link copied!");
  };

  const openTickets = tickets.filter(t => t.status === "open").length;
  const inProgressTickets = tickets.filter(t => t.status === "in_progress").length;
  const resolvedTickets = tickets.filter(t => t.status === "resolved").length;

  const filteredTickets = tickets.filter(t => {
    if (filter !== "all" && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.email.toLowerCase().includes(q) ||
        t.problem.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.phone && t.phone.includes(q))
      );
    }
    return true;
  });

  const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
    open: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: AlertCircle },
    in_progress: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Clock },
    resolved: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle },
  };

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Open", count: openTickets, key: "open" as const },
          { label: "In Progress", count: inProgressTickets, key: "in_progress" as const },
          { label: "Resolved", count: resolvedTickets, key: "resolved" as const },
        ].map((s) => {
          const sc = statusConfig[s.key];
          const Icon = sc.icon;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(filter === s.key ? "all" : s.key)}
              className={`relative rounded-xl p-4 border transition-all ${
                filter === s.key
                  ? `${sc.bg} ${sc.border} border ring-1 ring-${s.key === "open" ? "red" : s.key === "in_progress" ? "amber" : "emerald"}-500/20`
                  : "bg-card/30 border-border/50 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg ${sc.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${sc.color}`} />
                </div>
                <div className="text-left">
                  <p className={`text-2xl font-bold ${sc.color}`}>{s.count}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                </div>
              </div>
              {filter === s.key && (
                <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${sc.bg.replace("/10", "/60")}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, issue, phone..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card/50 border border-border/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all placeholder:text-muted-foreground/50"
          />
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading} className="gap-2 h-10">
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tickets */}
      <div className="space-y-2">
        {filteredTickets.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-card/20 p-12 text-center">
            <Ticket className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-muted-foreground text-sm">
              {search ? "No tickets match your search" : filter !== "all" ? `No ${filter.replace("_", " ")} tickets` : "No tickets yet"}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const sc = statusConfig[ticket.status] || statusConfig.open;
            const Icon = sc.icon;
            return (
              <div
                key={ticket.id}
                className="group rounded-xl border border-border/30 bg-card/20 hover:bg-card/40 hover:border-border/50 transition-all overflow-hidden"
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Status indicator */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${sc.bg} border ${sc.border} flex items-center justify-center mt-0.5`}>
                    <Icon className={`w-4 h-4 ${sc.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-muted-foreground/50 tracking-wider">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-muted-foreground/30">•</span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {format(new Date(ticket.created_at), "MMM d, h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground/90 line-clamp-1 mb-1.5">
                      {ticket.problem}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/60">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {ticket.email}
                      </span>
                      {ticket.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {ticket.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Link to={`/ticket/${ticket.id}`}>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-primary">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-primary"
                      onClick={() => copyTicketLink(ticket.id)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {ticket.status === "open" && (
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-amber-400/60 hover:text-amber-400"
                        onClick={() => updateTicketStatus(ticket.id, "in_progress")}>
                        <Clock className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {ticket.status === "in_progress" && (
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-emerald-400/60 hover:text-emerald-400"
                        onClick={() => updateTicketStatus(ticket.id, "resolved")}>
                        <CheckCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {ticket.status === "resolved" && (
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-red-400/60 hover:text-red-400"
                        onClick={() => updateTicketStatus(ticket.id, "open")}>
                        <AlertCircle className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon"
                      className="w-8 h-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteTicket(ticket.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[10px] text-muted-foreground/30 text-center">
        Showing {filteredTickets.length} of {tickets.length} tickets
      </p>
    </div>
  );
};
