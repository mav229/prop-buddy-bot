import { useState } from "react";
import { Star, Send, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const GOOGLE_REVIEW_LINK = "https://g.page/r/CdHO0VDiVc1aEAI/review";
const TRUSTPILOT_LINK = "https://www.trustpilot.com/review/propscholar.com";

const defaultSubtitle = "Your journey with PropScholar has been incredible — we'd love to hear about it! A quick review helps fellow traders find us and keeps us motivated.";

export const TestimonialManager = () => {
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const buildHtml = (name: string, sub: string) => {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <!-- Header -->
    <div style="background:#0a0a0a;padding:32px 24px;text-align:center;border-radius:0 0 12px 12px;">
      <h1 style="color:#ffffff;font-size:26px;margin:0 0 4px;font-weight:700;letter-spacing:-0.5px;">PropScholar</h1>
      <p style="color:#888888;font-size:13px;margin:0;">Prop Trading Excellence</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 28px;">
      <h2 style="font-size:22px;color:#111827;margin:0 0 6px;font-weight:700;">Hey ${name} 👋</h2>
      <h3 style="font-size:17px;color:#111827;margin:0 0 20px;font-weight:600;">How was your experience with PropScholar?</h3>
      
      <p style="font-size:14px;color:#555555;line-height:1.7;margin:0 0 28px;">${sub}</p>

      <!-- Stars decoration -->
      <div style="text-align:center;margin:0 0 28px;">
        <span style="font-size:32px;">⭐⭐⭐⭐⭐</span>
      </div>

      <!-- CTA Buttons -->
      <div style="text-align:center;margin:0 0 16px;">
        <a href="${GOOGLE_REVIEW_LINK}" target="_blank" style="display:inline-block;background:#4A90D9;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
          ⭐ Rate us on Google
        </a>
      </div>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${TRUSTPILOT_LINK}" target="_blank" style="display:inline-block;background:#00b67a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
          ★ Rate us on Trustpilot
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />

      <p style="font-size:13px;color:#999999;line-height:1.6;margin:0;text-align:center;">
        Thank you for being part of the PropScholar family.<br/>
        Your review means the world to us! 🙏
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 28px;text-align:center;border-radius:12px 12px 0 0;">
      <p style="font-size:12px;color:#aaaaaa;margin:0;">
        © ${new Date().getFullYear()} PropScholar · team@propscholar.in
      </p>
    </div>
  </div>
</body>
</html>`;
  };

  const handleSend = async () => {
    if (!recipientEmail || !recipientName) {
      toast({ title: "Missing fields", description: "Name and email are required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: recipientEmail,
          subject: `${recipientName}, we'd love your feedback! ⭐`,
          body: `Hey ${recipientName}, how was your experience with PropScholar? Leave us a review!`,
          html: buildHtml(recipientName, subtitle),
          templateId: "testimonial-request",
          recipientName,
        },
      });

      if (error) throw error;

      toast({ title: "Email sent!", description: `Testimonial request sent to ${recipientName}` });
      setRecipientName("");
      setRecipientEmail("");
    } catch (err: any) {
      toast({ title: "Failed to send", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Testimonial Requests</h2>
        <p className="text-muted-foreground">Send review request emails to customers after payout</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send Form */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Send Review Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                placeholder="e.g. Moksha Studio"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Customer Email</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle / Message</Label>
              <Textarea
                rows={4}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSend} disabled={sending} className="flex-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Send Email
              </Button>
              <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
                {previewMode ? "Hide" : "Preview"}
              </Button>
            </div>

            <div className="flex gap-3 pt-2">
              <a href={GOOGLE_REVIEW_LINK} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Google Reviews <ExternalLink className="w-3 h-3" />
              </a>
              <a href={TRUSTPILOT_LINK} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                Trustpilot <ExternalLink className="w-3 h-3" />
              </a>
            </div>
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
                  srcDoc={buildHtml(recipientName || "John", subtitle)}
                  className="w-full h-[500px] border-0"
                  title="Email Preview"
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
