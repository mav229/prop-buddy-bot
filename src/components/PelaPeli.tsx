import { useState, useEffect } from "react";
import {
  AlertTriangle, Mail, CheckCircle2, Loader2, RefreshCw, User, Shield, Clock, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FlaggedAccount {
  id: string;
  account_number: string;
  user_name: string | null;
  email: string | null;
  flag_type: string;
  flag_detail: string | null;
  risk_level: string;
  metrics_snapshot: any;
  flagged_at: string;
  emailed_at: string | null;
}

const VIOLATION_EMAIL_HTML = (userName: string, accountNumber: string, flagDetail: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:32px 24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">⚠️ Trading Violation Detected</h1>
    <p style="color:#fecaca;margin:8px 0 0;font-size:14px;">PropScholar Risk Management</p>
  </div>
  <div style="padding:32px 24px;">
    <p style="color:#1f2937;font-size:15px;line-height:1.6;">Hi <strong>${userName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      Our automated risk monitoring system has detected trading violations on your account <strong>#${accountNumber}</strong>.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="color:#991b1b;font-size:13px;margin:0;font-weight:600;">Violation Details:</p>
      <p style="color:#7f1d1d;font-size:13px;margin:8px 0 0;line-height:1.5;">${flagDetail}</p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      This is a formal notice. Repeated violations may result in account suspension or termination per our terms of service.
    </p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      If you believe this is an error, please reply to this email or contact our support team immediately.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
    <p style="color:#6b7280;font-size:12px;text-align:center;">
      PropScholar Risk Management Team<br/>
      This is an automated notification — please do not ignore.
    </p>
  </div>
</div>
</body>
</html>
`;

// 🔴 MASTER SWITCH — set to true when ready to go live
const EMAILS_ENABLED = false;

export const PelaPeli = () => {
  const [accounts, setAccounts] = useState<FlaggedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "emailed" | "all">("pending");

  const fetchAccounts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("flagged_accounts")
      .select("*")
      .order("flagged_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAccounts((data as unknown as FlaggedAccount[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const sendViolationEmail = async (account: FlaggedAccount) => {
    if (!EMAILS_ENABLED) {
      toast({ title: "Emails Paused", description: "Email sending is currently disabled. Flip EMAILS_ENABLED to true when ready.", variant: "destructive" });
      return;
    }
    if (!account.email) {
      toast({ title: "No email", description: `Account ${account.account_number} has no email address.`, variant: "destructive" });
      return;
    }

    setSendingId(account.id);
    try {
      const html = VIOLATION_EMAIL_HTML(
        account.user_name || "Trader",
        account.account_number,
        account.flag_detail || account.flag_type
      );

      const { error: emailError } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: account.email,
          subject: `⚠️ Trading Violation Notice — Account #${account.account_number}`,
          html,
          templateId: "violation-notice",
          recipientName: account.user_name || "Trader",
        },
      });

      if (emailError) throw emailError;

      // Mark as emailed
      const { error: updateError } = await supabase
        .from("flagged_accounts")
        .update({ emailed_at: new Date().toISOString() } as any)
        .eq("id", account.id);

      if (updateError) throw updateError;

      toast({ title: "Email sent ✅", description: `Violation notice sent to ${account.email}` });
      fetchAccounts();
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message || "Unknown error", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const filtered = accounts.filter((a) => {
    if (filter === "pending") return !a.emailed_at;
    if (filter === "emailed") return !!a.emailed_at;
    return true;
  });

  const pendingCount = accounts.filter((a) => !a.emailed_at).length;
  const emailedCount = accounts.filter((a) => !!a.emailed_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-500" /> Pela Peli
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Send violation notices to flagged accounts. Once emailed, they're permanently excluded from future scans.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer border-2 transition-colors"
          style={{ borderColor: filter === "pending" ? "hsl(var(--primary))" : "transparent" }}
          onClick={() => setFilter("pending")}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Email</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer border-2 transition-colors"
          style={{ borderColor: filter === "emailed" ? "hsl(var(--primary))" : "transparent" }}
          onClick={() => setFilter("emailed")}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{emailedCount}</p>
              <p className="text-xs text-muted-foreground">Emailed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer border-2 transition-colors"
          style={{ borderColor: filter === "all" ? "hsl(var(--primary))" : "transparent" }}
          onClick={() => setFilter("all")}>
          <CardContent className="p-4 flex items-center gap-3">
            <User className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{accounts.length}</p>
              <p className="text-xs text-muted-foreground">Total Flagged</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No {filter === "pending" ? "pending" : filter === "emailed" ? "emailed" : ""} accounts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((account) => (
            <Card key={account.id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-sm">{account.account_number}</span>
                      <Badge variant="outline" className={
                        account.risk_level === "VERY HIGH" ? "bg-red-500/10 text-red-500 border-red-500/30" :
                        account.risk_level === "HIGH" ? "bg-orange-500/10 text-orange-500 border-orange-500/30" :
                        "bg-yellow-500/10 text-yellow-500 border-yellow-500/30"
                      }>
                        {account.risk_level}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {account.flag_type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      <User className="w-3 h-3 inline mr-1" />
                      {account.user_name || "Unknown"} 
                      {account.email && <span className="ml-2 text-xs opacity-70">({account.email})</span>}
                    </p>
                    {account.flag_detail && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 opacity-70">
                        {account.flag_detail}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Flagged: {new Date(account.flagged_at).toLocaleDateString()}
                      </span>
                      {account.emailed_at && (
                        <span className="flex items-center gap-1 text-green-500">
                          <Send className="w-3 h-3" />
                          Emailed: {new Date(account.emailed_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {account.emailed_at ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Sent
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={!account.email || sendingId === account.id}
                        onClick={() => sendViolationEmail(account)}
                      >
                        {sendingId === account.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <Mail className="w-4 h-4 mr-1" />
                        )}
                        {!account.email ? "No Email" : "Send Notice"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
