import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Trash2, Mail, Calendar, ExternalLink, Loader2, Users, Copy, FileText, User } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Lead {
  id: string;
  email: string;
  name: string | null;
  session_id: string | null;
  source: string;
  page_url: string | null;
  created_at: string;
}

export const LeadsManager = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("widget_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast.error("Failed to load leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from("widget_leads")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setLeads(leads.filter((l) => l.id !== id));
      toast.success("Lead deleted");
    } catch (err) {
      console.error("Error deleting lead:", err);
      toast.error("Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  };

  // Generate plain text format for copying/downloading
  const generatePlainText = () => {
    const filtered = filteredLeads;
    if (filtered.length === 0) return "";

    return filtered
      .map((lead) => {
        const parts = [];
        if (lead.name) parts.push(`Name: ${lead.name}`);
        parts.push(`Email: ${lead.email}`);
        parts.push(`Source: ${lead.source}`);
        if (lead.page_url) parts.push(`Page: ${lead.page_url}`);
        parts.push(`Date: ${format(new Date(lead.created_at), "yyyy-MM-dd HH:mm")}`);
        return parts.join("\n");
      })
      .join("\n\n---\n\n");
  };

  const handleCopyAll = async () => {
    const text = generatePlainText();
    if (!text) {
      toast.error("No leads to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${filteredLeads.length} leads to clipboard`);
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDownloadTxt = () => {
    const text = generatePlainText();
    if (!text) {
      toast.error("No leads to download");
      return;
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-export-${format(new Date(), "yyyy-MM-dd")}.txt`;
    link.click();

    toast.success(`Downloaded ${filteredLeads.length} leads as TXT`);
  };

  const handleExportCSV = () => {
    const filtered = filteredLeads;
    if (filtered.length === 0) {
      toast.error("No leads to export");
      return;
    }

    const headers = ["Name", "Email", "Source", "Page URL", "Date"];
    const rows = filtered.map((lead) => [
      lead.name || "",
      lead.email,
      lead.source,
      lead.page_url || "",
      format(new Date(lead.created_at), "yyyy-MM-dd HH:mm"),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leads-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast.success(`Exported ${filtered.length} leads as CSV`);
  };

  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      lead.email.toLowerCase().includes(query) ||
      (lead.name && lead.name.toLowerCase().includes(query))
    );
  });

  const stats = {
    total: leads.length,
    thisWeek: leads.filter((l) => {
      const date = new Date(l.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length,
    thisMonth: leads.filter((l) => {
      const date = new Date(l.created_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return date >= monthAgo;
    }).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.thisMonth}</p>
                <p className="text-xs text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leads Table */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Email Leads</CardTitle>
              <CardDescription>
                Emails collected from widget and ticket forms
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAll}
                className="gap-2"
                title="Copy all to clipboard"
              >
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTxt}
                className="gap-2"
                title="Download as TXT (Notepad)"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">TXT</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="gap-2"
                title="Download as CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? "No leads found matching your search" : "No leads collected yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="hidden sm:table-cell">Source</TableHead>
                    <TableHead className="hidden md:table-cell">Page</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground hidden sm:block" />
                          <span className="truncate max-w-[120px]">
                            {lead.name || <span className="text-muted-foreground">—</span>}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground hidden sm:block" />
                          <span className="truncate max-w-[180px]">{lead.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                          {lead.source}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {lead.page_url ? (
                          <a
                            href={lead.page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors truncate max-w-[150px]"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {new URL(lead.page_url).pathname || "/"}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(lead.id)}
                          disabled={deletingId === lead.id}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          {deletingId === lead.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};