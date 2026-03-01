import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthForm } from "@/components/AuthForm";
import {
  ArrowLeft, Mail, Phone, Clock, CheckCircle, AlertCircle,
  MessageSquare, Loader2, Copy, ExternalLink, Shield
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Ticket {
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

const TicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (!id || !isAdmin) return;
    fetchTicket();
  }, [id, isAdmin]);

  const fetchTicket = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id!)
      .maybeSingle();

    if (error || !data) {
      toast.error("Ticket not found");
    } else {
      setTicket(data);
      // Parse chat history
      if (data.chat_history) {
        try {
          const parsed = JSON.parse(data.chat_history);
          if (Array.isArray(parsed)) setChatMessages(parsed);
        } catch {
          setChatMessages([]);
        }
      }
    }
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    if (!ticket) return;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticket.id);
    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success(`Status → ${status}`);
      setTicket({ ...ticket, status });
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,3%)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (!user) return <AuthForm />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,3%)] flex items-center justify-center">
        <div className="text-center p-8">
          <Shield className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-white/40 text-sm">Admin access required.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,3%)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,3%)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Ticket Not Found</h1>
          <Link to="/admin" className="text-blue-400 hover:underline text-sm">← Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
    open: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: AlertCircle, label: "Open" },
    in_progress: { color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Clock, label: "In Progress" },
    resolved: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle, label: "Resolved" },
  };
  const sc = statusConfig[ticket.status] || statusConfig.open;
  const StatusIcon = sc.icon;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,3%)]">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/3 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-500/3 rounded-full blur-[180px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyLink} className="text-white/40 hover:text-white/70 gap-2">
              <Copy className="w-3.5 h-3.5" />
              Copy Link
            </Button>
            <a href={`mailto:${ticket.email}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white/70 gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                Reply via Email
              </Button>
            </a>
          </div>
        </div>

        {/* Main card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-2xl overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.02] to-transparent">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-mono text-white/30 tracking-wider">
                    TICKET #{ticket.id.slice(0, 8).toUpperCase()}
                  </span>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${sc.bg} ${sc.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {sc.label}
                  </div>
                  <Badge variant="outline" className="text-[10px] text-white/30 border-white/10">
                    {ticket.source}
                  </Badge>
                </div>
                <h1 className="text-lg font-semibold text-white/90 leading-snug max-w-xl">
                  {ticket.problem.length > 120 ? ticket.problem.slice(0, 120) + "..." : ticket.problem}
                </h1>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {ticket.status === "open" && (
                  <Button size="sm" onClick={() => updateStatus("in_progress")}
                    className="bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:bg-amber-500/30 gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> In Progress
                  </Button>
                )}
                {ticket.status === "in_progress" && (
                  <Button size="sm" onClick={() => updateStatus("resolved")}
                    className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Resolve
                  </Button>
                )}
                {ticket.status === "resolved" && (
                  <Button size="sm" onClick={() => updateStatus("open")}
                    className="bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30 gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Reopen
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-b border-white/[0.06]">
            <div className="px-8 py-5 border-b sm:border-b-0 sm:border-r border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase tracking-widest mb-2">
                <Mail className="w-3 h-3" /> Email
              </div>
              <a href={`mailto:${ticket.email}`} className="text-sm text-blue-400 hover:underline font-medium">
                {ticket.email}
              </a>
            </div>
            <div className="px-8 py-5 border-b sm:border-b-0 sm:border-r border-white/[0.06]">
              <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase tracking-widest mb-2">
                <Phone className="w-3 h-3" /> Phone
              </div>
              <p className="text-sm text-white/70 font-medium">
                {ticket.phone || <span className="text-white/20 italic">Not provided</span>}
              </p>
            </div>
            <div className="px-8 py-5">
              <div className="flex items-center gap-2 text-white/30 text-[10px] uppercase tracking-widest mb-2">
                <Clock className="w-3 h-3" /> Created
              </div>
              <p className="text-sm text-white/70 font-medium">
                {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {/* Problem description */}
          <div className="px-8 py-6 border-b border-white/[0.06]">
            <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-3 flex items-center gap-2">
              <MessageSquare className="w-3 h-3" /> Issue Description
            </h3>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
              {ticket.problem}
            </p>
          </div>

          {/* Chat transcript */}
          {chatMessages.length > 0 && (
            <div className="px-8 py-6">
              <h3 className="text-[10px] uppercase tracking-widest text-white/30 mb-4 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Chat Transcript ({chatMessages.length} messages)
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-white/10 text-white/80 rounded-tr-md"
                          : "bg-white/[0.04] border border-white/[0.06] text-white/60 rounded-tl-md"
                      }`}
                    >
                      <div className="text-[9px] uppercase tracking-widest mb-1 opacity-40">
                        {msg.role === "user" ? "Customer" : "Scholaris AI"}
                      </div>
                      {msg.content.replace(/\[\[OPEN_TICKET_FORM\]\]/g, "").trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chatMessages.length === 0 && (
            <div className="px-8 py-10 text-center">
              <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-2" />
              <p className="text-xs text-white/20">No chat transcript attached</p>
            </div>
          )}
        </div>

        {/* Session info */}
        {ticket.session_id && (
          <div className="mt-4 text-center">
            <span className="text-[10px] font-mono text-white/15">
              Session: {ticket.session_id}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketDetail;
