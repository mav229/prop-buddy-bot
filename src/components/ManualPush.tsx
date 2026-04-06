import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ManualPush = () => {
  const [name, setName] = useState("");
  const [certType, setCertType] = useState<"completion" | "achievement">("completion");
  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<{ name: string; type: string; url: string } | null>(null);

  const handleSend = async () => {
    if (!name.trim()) {
      toast.error("Enter a name first");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("fake-cert-announce", {
        body: { action: "manual_push", name: name.trim(), cert_type: certType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastSent({ name: data.sent, type: data.type, url: data.certificate_url });
      toast.success(`Certificate sent for ${data.sent}`);
      setName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Manual Push</h2>
        <p className="text-muted-foreground">Send a custom certificate announcement to Discord</p>
      </div>

      <Card className="border-border/50 bg-card/30">
        <CardHeader>
          <CardTitle className="text-lg">Send Certificate</CardTitle>
          <CardDescription>Enter a name and choose the certificate type to push to Discord</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cert-name">Name</Label>
            <Input
              id="cert-name"
              placeholder="e.g. John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !sending && handleSend()}
            />
          </div>

          <div className="space-y-3">
            <Label>Certificate Type</Label>
            <RadioGroup value={certType} onValueChange={(v) => setCertType(v as any)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="completion" id="completion" />
                <Label htmlFor="completion" className="cursor-pointer font-normal">
                  ✅ Phase 1 Completion
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="achievement" id="achievement" />
                <Label htmlFor="achievement" className="cursor-pointer font-normal">
                  🏆 Achievement (Funded)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Button onClick={handleSend} disabled={sending || !name.trim()} className="w-full">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? "Sending..." : "Push to Discord"}
          </Button>
        </CardContent>
      </Card>

      {lastSent && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="font-medium">Last sent: <span className="text-green-400">{lastSent.name}</span></p>
                <p className="text-sm text-muted-foreground">
                  Type: {lastSent.type === "achievement" ? "🏆 Achievement" : "✅ Completion"}
                </p>
                {lastSent.url && (
                  <a href={lastSent.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground underline">
                    View certificate image
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
