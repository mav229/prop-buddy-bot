import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ManualPush = () => {
  const [pushType, setPushType] = useState<"order" | "certificate">("order");

  // Order fields
  const [customerName, setCustomerName] = useState("");
  const [accountSize, setAccountSize] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  // Certificate fields
  const [certName, setCertName] = useState("");
  const [certType, setCertType] = useState<"completion" | "achievement">("completion");
  const [saveToHall, setSaveToHall] = useState(true);

  const [sending, setSending] = useState(false);
  const [lastSent, setLastSent] = useState<{ type: string; name: string; detail?: string } | null>(null);

  const handleSendOrder = async () => {
    if (!customerName.trim()) { toast.error("Enter customer name"); return; }
    if (!accountSize.trim()) { toast.error("Enter account size"); return; }
    if (!paymentMethod.trim()) { toast.error("Enter payment method"); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("fake-cert-announce", {
        body: {
          action: "order_confirm",
          customer_name: customerName.trim(),
          account_size: accountSize.trim(),
          payment_method: paymentMethod.trim(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastSent({ type: "order", name: customerName, detail: `${accountSize} • ${paymentMethod}` });
      toast.success(`Order confirmation sent for ${customerName}`);
      setCustomerName("");
      setAccountSize("");
      setPaymentMethod("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleSendCertificate = async () => {
    if (!certName.trim()) { toast.error("Enter a name"); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("fake-cert-announce", {
        body: { action: "manual_push", name: certName.trim(), cert_type: certType, save_to_hall: saveToHall },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastSent({ type: "certificate", name: data.sent, detail: data.type === "achievement" ? "🏆 Achievement" : "✅ Completion" });
      toast.success(`Certificate sent for ${data.sent}`);
      setCertName("");
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
        <p className="text-muted-foreground">Send order confirmations or certificate announcements to Discord</p>
      </div>

      {/* Push type selector */}
      <div className="flex gap-2">
        <Button
          variant={pushType === "order" ? "default" : "outline"}
          size="sm"
          onClick={() => setPushType("order")}
        >
          🛒 Order Confirmation
        </Button>
        <Button
          variant={pushType === "certificate" ? "default" : "outline"}
          size="sm"
          onClick={() => setPushType("certificate")}
        >
          📜 Certificate
        </Button>
      </div>

      {/* Order Confirmation Form */}
      {pushType === "order" && (
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-lg">🛒 Send Order Confirmation</CardTitle>
            <CardDescription>Push a confirmed order announcement to Discord</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cust-name">Customer Name</Label>
              <Input
                id="cust-name"
                placeholder="e.g. John Smith"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acc-size">Account Size</Label>
                <Input
                  id="acc-size"
                  placeholder="e.g. $5K, $10K, $25K"
                  value={accountSize}
                  onChange={(e) => setAccountSize(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-method">Payment Method</Label>
                <Input
                  id="pay-method"
                  placeholder="e.g. Crypto, Card, UPI"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleSendOrder} disabled={sending || !customerName.trim() || !accountSize.trim() || !paymentMethod.trim()} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? "Sending..." : "Push Order to Discord"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Certificate Form */}
      {pushType === "certificate" && (
        <Card className="border-border/50 bg-card/30">
          <CardHeader>
            <CardTitle className="text-lg">📜 Send Certificate</CardTitle>
            <CardDescription>Push a certificate announcement to Discord</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="cert-name">Name</Label>
              <Input
                id="cert-name"
                placeholder="e.g. John Smith"
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Certificate Type</Label>
              <RadioGroup value={certType} onValueChange={(v) => setCertType(v as any)} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="completion" id="completion" />
                  <Label htmlFor="completion" className="cursor-pointer font-normal">✅ Phase 1 Completion</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="achievement" id="achievement" />
                  <Label htmlFor="achievement" className="cursor-pointer font-normal">🏆 Achievement (Funded)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="save-hall" checked={saveToHall} onCheckedChange={(v) => setSaveToHall(!!v)} />
              <Label htmlFor="save-hall" className="cursor-pointer font-normal text-sm">Also save to Hall of Fame</Label>
            </div>
            <Button onClick={handleSendCertificate} disabled={sending || !certName.trim()} className="w-full">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending ? "Sending..." : "Push Certificate to Discord"}
            </Button>
          </CardContent>
        </Card>
      )}

      {lastSent && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Last sent: <span className="text-emerald-400">{lastSent.name}</span></p>
                <p className="text-sm text-muted-foreground">{lastSent.detail}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
