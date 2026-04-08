import { useState, useEffect } from "react";
import { Star, Loader2, Power, Mail, Clock, User, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const BANNER_URL = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/testimonial-banner.png";
const GOOGLE_REVIEW_LINK = "https://g.page/r/CdHO0VDiVc1aEAI/review";
const TRUSTPILOT_LINK = "https://www.trustpilot.com/review/propscholar.com";
const ICON_IG = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-instagram.png";
const ICON_DC = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-discord.png";
const ICON_X = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-x.png";
const ICON_YT = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-youtube.png";
const ICON_PS = "https://pcvkjrxrlibhyyxldbzs.supabase.co/storage/v1/object/public/email-assets/icon-propscholar.png";

export const TestimonialManager = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("testimonial_settings")
      .select("*")
      .limit(1)
      .single();
    if (data) {
      setIsEnabled(data.is_enabled);
      setSettingsId(data.id);
    }
    setLoading(false);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("email_logs")
      .select("*")
      .in("template_id", ["testimonial-auto", "testimonial-request"])
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);
    setLogsLoading(false);
  };

  const handleToggle = async (enabled: boolean) => {
    if (!settingsId) return;
    setToggling(true);
    const { error } = await supabase
      .from("testimonial_settings")
      .update({ is_enabled: enabled })
      .eq("id", settingsId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setIsEnabled(enabled);
      toast({
        title: enabled ? "Automation ON" : "Automation OFF",
        description: enabled
          ? "Testimonial emails will be sent to completed payout users"
          : "Testimonial automation paused",
      });
    }
    setToggling(false);
  };

  const buildPreviewHtml = () => {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="text-align:center;">
      <img src="${BANNER_URL}" alt="How was your experience?" style="width:100%;max-width:600px;display:block;" />
    </div>
    <div style="padding:36px 28px;text-align:center;">
      <h2 style="font-size:22px;color:#111827;margin:0 0 8px;font-weight:700;">Be honest… how did we do? Rate Us Below 😉</h2>
      <p style="font-size:14px;color:#777777;margin:0 0 24px;">How was your PayUp experience?</p>
      <div style="margin:0 0 28px;">
        <span style="font-size:36px;color:#f5a623;">★ ★ ★ ★ ★</span>
      </div>
      <div style="margin:0 0 14px;">
        <a href="${TRUSTPILOT_LINK}" target="_blank" style="display:inline-block;background:#00b67a;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">
          Review Us on Trustpilot
        </a>
      </div>
      <div style="margin:0 0 28px;">
        <a href="${GOOGLE_REVIEW_LINK}" target="_blank" style="display:inline-block;background:#4285F4;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:600;">
          Review Us on Google
        </a>
      </div>
    </div>
    <div style="background:#0f1729;padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;">
          <a href="https://propscholar.com" target="_blank" style="text-decoration:none;"><img src="${ICON_PS}" alt="PropScholar" width="32" height="32" style="border-radius:4px;" /></a>
        </td>
        <td style="vertical-align:middle;text-align:right;">
          <a href="https://www.instagram.com/propscholar/" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_IG}" alt="Instagram" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://discord.gg/propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_DC}" alt="Discord" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://x.com/propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_X}" alt="X" width="26" height="26" style="border-radius:4px;" /></a>
          <a href="https://www.youtube.com/@propscholar" target="_blank" style="text-decoration:none;margin-left:10px;"><img src="${ICON_YT}" alt="YouTube" width="26" height="26" style="border-radius:4px;" /></a>
        </td>
      </tr></table>
    </div>
  </div>
</body>
</html>`;
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Testimonial Automation</h2>
        <p className="text-muted-foreground">
          Auto-sends review request emails to users with completed payouts
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Automation Control */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Power className="w-5 h-5" />
              Automation Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/30">
              <div className="space-y-1">
                <Label className="text-base font-semibold">
                  Auto-send testimonial emails
                </Label>
                <p className="text-sm text-muted-foreground">
                  Sends to users when payout status is COMPLETED
                </p>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={toggling}
              />
            </div>

            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isEnabled ? "bg-green-500 animate-pulse" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-medium">
                {isEnabled ? "Automation is ACTIVE" : "Automation is PAUSED"}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Checks for COMPLETED payouts with email addresses</p>
              <p>• Sends one email per certificate (never duplicates)</p>
              <p>• Subject: "Share your PropScholar experience"</p>
              <p>• Preheader: "We Back Traders"</p>
            </div>

            <Button variant="outline" onClick={() => setPreviewMode(!previewMode)} className="w-full">
              {previewMode ? "Hide Preview" : "Preview Email Template"}
            </Button>
          </CardContent>
        </Card>

        {/* Preview */}
        {previewMode && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Email Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border border-border/30 bg-white">
                <iframe
                  srcDoc={buildPreviewHtml()}
                  className="w-full h-[500px] border-0"
                  title="Email Preview"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Email Logs */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Sent Emails Log
            <Badge variant="secondary" className="ml-auto">
              {logs.length} emails
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No testimonial emails sent yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {log.recipient_name || log.recipient_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {log.recipient_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <Badge
                        variant={log.source === "automation" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {log.source === "automation" ? "Auto" : "Manual"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.created_at)}
                    </div>
                    {log.opened_at && (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
