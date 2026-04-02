import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, RefreshCw, Search, ShoppingCart, Mail, Loader2, Eye, Check } from "lucide-react";
import { cartEmailTemplates, getTemplateById } from "@/lib/cartEmailTemplates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AbandonedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  cartItems: number;
  cartDetails: { product: string; variant: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
}

export const AbandonedCheckouts = () => {
  const [data, setData] = useState<AbandonedUser[]>([]);
  const [filtered, setFiltered] = useState<AbandonedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Template selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState(cartEmailTemplates[0].id);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const fetchAbandoned = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await supabase.functions.invoke("abandoned-checkouts");
      if (res.error) throw res.error;
      const result = res.data;
      setData(result.abandoned || []);
      setFiltered(result.abandoned || []);
      setLastRefresh(new Date());
      setCountdown(60);
      if (!silent) toast.success(`Found ${result.total || 0} abandoned checkouts`);
    } catch (err: any) {
      console.error("Failed to fetch abandoned checkouts:", err);
      if (!silent) toast.error("Failed to fetch abandoned checkouts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAbandoned();
    intervalRef.current = setInterval(() => fetchAbandoned(true), 60000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAbandoned]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 60 : c - 1));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(data);
    } else {
      const q = search.toLowerCase();
      setFiltered(data.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.includes(q)
      ));
    }
  }, [search, data]);

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error("No data to export");
    const headers = ["Name", "Email", "Phone", "Cart Items", "Last Updated"];
    const rows = filtered.map(u => [
      u.name, u.email, u.phone, u.cartItems.toString(),
      u.updatedAt ? new Date(u.updatedAt).toLocaleDateString() : "N/A"
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abandoned-checkouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const exportTXT = () => {
    if (filtered.length === 0) return toast.error("No data to export");
    const txt = filtered.map(u => u.email).join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abandoned-emails-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Email list exported");
  };

  const previewTemplate = (templateId: string) => {
    const tpl = getTemplateById(templateId);
    if (!tpl) return;
    setPreviewHtml(tpl.buildHtml("John", 3));
    setPreviewOpen(true);
  };

  const sendReminder = async (user: AbandonedUser) => {
    const tpl = getTemplateById(selectedTemplateId);
    if (!tpl) return toast.error("Select a template first");

    setSendingEmail(user.id);
    try {
      const firstName = (user.name || "").split(" ")[0] || "there";
      const html = tpl.buildHtml(firstName, user.cartItems);
      const subject = tpl.subject(user.name || "there");

      const res = await supabase.functions.invoke("send-smtp-email", {
        body: { to: user.email, subject, html },
      });

      if (res.error) throw res.error;
      toast.success(`"${tpl.name}" sent to ${user.email}`);
    } catch (err: any) {
      console.error("Failed to send reminder:", err);
      toast.error("Failed to send reminder email");
    } finally {
      setSendingEmail(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Cart
          </h2>
          <p className="text-muted-foreground">
            Users who added items to cart but never completed payment
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground space-y-1">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live — refreshes in {countdown}s
          </div>
          {lastRefresh && <div>Last: {lastRefresh.toLocaleTimeString()}</div>}
        </div>
      </div>

      {/* Template Selector */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Email Template</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {cartEmailTemplates.map((tpl) => (
            <div
              key={tpl.id}
              onClick={() => setSelectedTemplateId(tpl.id)}
              className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                selectedTemplateId === tpl.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              {selectedTemplateId === tpl.id && (
                <div className="absolute top-2 right-2">
                  <Check className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className="font-medium text-sm mb-1">{tpl.name}</div>
              <div className="text-xs text-muted-foreground mb-3 truncate">
                {tpl.subject("User")}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  previewTemplate(tpl.id);
                }}
              >
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAbandoned()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportTXT}>
            <Download className="w-4 h-4 mr-1" />
            Emails TXT
          </Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {data.length} abandoned checkouts
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No abandoned checkouts found
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((user) => (
            <Card key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.name}</div>
                <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                {user.phone && <div className="text-xs text-muted-foreground">{user.phone}</div>}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{user.cartItems}</div>
                  <div className="text-xs text-muted-foreground">items</div>
                </div>
                <div className="text-center hidden sm:block">
                  <div className="text-sm">
                    {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground">last active</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendReminder(user)}
                  disabled={sendingEmail === user.id}
                  title={`Send "${getTemplateById(selectedTemplateId)?.name}" to ${user.email}`}
                >
                  {sendingEmail === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Template Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
          </DialogHeader>
          <div
            className="rounded-lg overflow-hidden border"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
