import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ticket, RefreshCw, Mail, Phone, MessageSquare, Clock, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const fetchTickets = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to load tickets");
    } else {
      setTickets(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);

    if (error) {
      toast.error("Failed to update ticket status");
    } else {
      toast.success(`Ticket marked as ${newStatus}`);
      fetchTickets();
    }
  };

  const deleteTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from("support_tickets")
      .delete()
      .eq("id", ticketId);

    if (error) {
      toast.error("Failed to delete ticket");
    } else {
      toast.success("Ticket deleted");
      fetchTickets();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" /> Open</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-600"><Clock className="w-3 h-3" /> In Progress</Badge>;
      case "resolved":
        return <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600"><CheckCircle className="w-3 h-3" /> Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openTickets = tickets.filter(t => t.status === "open").length;
  const inProgressTickets = tickets.filter(t => t.status === "in_progress").length;
  const resolvedTickets = tickets.filter(t => t.status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{openTickets}</p>
              <p className="text-xs text-muted-foreground">Open Tickets</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{inProgressTickets}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{resolvedTickets}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Support Tickets</h2>
            <p className="text-sm text-muted-foreground">{tickets.length} total tickets</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTickets} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No support tickets yet</p>
            </CardContent>
          </Card>
        ) : (
          tickets.map((ticket) => (
            <Card key={ticket.id} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{ticket.id.slice(0, 8).toUpperCase()}
                      </span>
                      {getStatusBadge(ticket.status)}
                      <Badge variant="outline" className="text-xs">
                        {ticket.source}
                      </Badge>
                    </div>
                    <p className="font-medium text-sm line-clamp-2">{ticket.problem}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteTicket(ticket.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <a href={`mailto:${ticket.email}`} className="hover:text-primary">
                      {ticket.email}
                    </a>
                  </div>
                  {ticket.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      <a href={`tel:${ticket.phone}`} className="hover:text-primary">
                        {ticket.phone}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </div>

                {/* Chat History */}
                {ticket.chat_history && (
                  <div>
                    <button
                      onClick={() => setExpandedTicket(expandedTicket === ticket.id ? null : ticket.id)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {expandedTicket === ticket.id ? "Hide" : "View"} chat history
                    </button>
                    {expandedTicket === ticket.id && (
                      <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs max-h-48 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-mono">{ticket.chat_history}</pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {ticket.status === "open" && (
                    <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, "in_progress")}>
                      Mark In Progress
                    </Button>
                  )}
                  {ticket.status === "in_progress" && (
                    <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, "resolved")}>
                      Mark Resolved
                    </Button>
                  )}
                  {ticket.status === "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => updateTicketStatus(ticket.id, "open")}>
                      Reopen
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
