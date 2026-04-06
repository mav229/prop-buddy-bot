import { useState, useEffect } from "react";
import { Bot, ExternalLink, Loader2, CheckCircle, AlertCircle, DatabaseBackup, Bell, Save, Send, Sparkles, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const DiscordSettings = () => {
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [certChannelId1, setCertChannelId1] = useState("");
  const [certChannelId2, setCertChannelId2] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [fakeEnabled, setFakeEnabled] = useState(false);
  const [fakeLastRun, setFakeLastRun] = useState<string | null>(null);
  const [fakeNextRun, setFakeNextRun] = useState<string | null>(null);
  const [fakeSending, setFakeSending] = useState(false);
  const [fakeToggling, setFakeToggling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadChannelConfig = async () => {
      const { data } = await supabase
        .from("widget_config")
        .select("config")
        .eq("id", "cert_announce_channel")
        .maybeSingle();
      if (data?.config && typeof data.config === "object") {
        const cfg = data.config as Record<string, string>;
        setCertChannelId1(cfg.channel_id_1 || cfg.channel_id || "");
        setCertChannelId2(cfg.channel_id_2 || "");
      }
    };
    const loadFakeConfig = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fake-cert-announce`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "status" }),
        });
        const data = await res.json();
        setFakeEnabled(!!data.enabled);
        setFakeLastRun(data.last_run || null);
        setFakeNextRun(data.next_run || null);
      } catch (_) {}
    };
    loadChannelConfig();
    loadFakeConfig();
  }, []);

  const handleSaveChannel = async () => {
    setSavingChannel(true);
    try {
      const { error } = await supabase
        .from("widget_config")
        .upsert({
          id: "cert_announce_channel",
          config: { channel_id_1: certChannelId1.trim(), channel_id_2: certChannelId2.trim() },
        }, { onConflict: "id" });
      if (error) throw error;
      toast({ title: "Saved", description: "Certificate announcement channels updated." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed to save" });
    } finally {
      setSavingChannel(false);
    }
  };

  const handleManualTrigger = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-certificates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manual_announce" }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
      toast({
        title: "Announcement sent!",
        description: `Sent ${data.announced || 0} certificate(s) to Discord.`,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed to trigger" });
    } finally {
      setTriggering(false);
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-bot`;

  const handleRegisterCommands = async () => {
    setRegistering(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register_commands" }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || "Failed to register commands");
      toast({ title: "Slash command registered", description: "Use /ask in your server." });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: e instanceof Error ? e.message : "Failed to register commands",
      });
    } finally {
      setRegistering(false);
    }
  };

  const handleTest = async () => {
    if (!testMessage.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a test message",
      });
      return;
    }

    setLoading(true);
    setTestResponse(null);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "test",
          message: testMessage,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setTestResponse(data.response);
      toast({
        title: "Test successful",
        description: "The bot responded correctly.",
      });
    } catch (error) {
      console.error("Test error:", error);
      toast({
        variant: "destructive",
        title: "Test failed",
        description: error instanceof Error ? error.message : "Failed to test bot",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 flex items-center justify-center">
          <Bot className="w-5 h-5 text-[#5865F2]" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Discord Integration</h2>
          <p className="text-sm text-muted-foreground">
            Configure PropScholar AI for Discord
          </p>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-success" />
          Bot Token Configured
        </h3>
        
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>Your Discord bot token is set. Complete these steps to finish setup:</p>
          
          <ol className="list-decimal list-inside space-y-2 ml-2">
            <li>Go to the <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Discord Developer Portal</a></li>
            <li>Select your application → Bot section</li>
            <li>Invite the bot to your server (OAuth2 → URL Generator, scopes: <code className="bg-muted px-1 rounded">bot</code>, <code className="bg-muted px-1 rounded">applications.commands</code>)</li>
            <li>Paste the Interactions Endpoint URL below into your app's <strong>Interactions Endpoint URL</strong> field and save</li>
            <li>Click <strong>Register /ask command</strong> below (one-time)</li>
            <li>In your server, use <code className="bg-muted px-1 rounded">/ask</code> to ask questions</li>
          </ol>
        </div>

        <div className="pt-4 border-t border-border space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Interactions Endpoint URL (for slash commands)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  toast({ title: "Copied to clipboard" });
                }}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Paste this URL in your Discord app's Interactions Endpoint URL field.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Note: In this serverless mode, the bot responds via <strong>/ask</strong> (slash command) — it won't auto-reply to @mentions.
            </p>
          </div>

          <Button onClick={handleRegisterCommands} disabled={registering} variant="secondary">
            {registering && <Loader2 className="w-4 h-4 animate-spin" />}
            Register /ask command
          </Button>
        </div>
      </div>

      {/* Test Bot */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="font-display font-semibold">Test the Bot</h3>
        <p className="text-sm text-muted-foreground">
          Send a test message to verify the bot is working correctly.
        </p>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="test-message">Test Message</Label>
            <Input
              id="test-message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="e.g., What are the drawdown rules?"
            />
          </div>

          <Button onClick={handleTest} disabled={loading} variant="premium">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Test Bot Response
          </Button>

          {testResponse && (
            <div className="mt-4 p-4 bg-secondary/50 rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Bot Response:</Label>
              <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
            </div>
          )}
        </div>
      </div>

      {/* Certificate Announcements Channel */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-semibold">Certificate Announcements</h3>
            <p className="text-sm text-muted-foreground">
              New certificates will be announced with a rich embed in these Discord channels.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cert-channel-1">Channel 1 (Primary)</Label>
            <Input
              id="cert-channel-1"
              value={certChannelId1}
              onChange={(e) => setCertChannelId1(e.target.value)}
              placeholder="e.g., 1234567890123456789"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cert-channel-2">Channel 2 (Optional)</Label>
            <Input
              id="cert-channel-2"
              value={certChannelId2}
              onChange={(e) => setCertChannelId2(e.target.value)}
              placeholder="e.g., 9876543210987654321"
              className="font-mono text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Right-click a Discord channel → Copy Channel ID (enable Developer Mode in Discord settings first).
          </p>
          <div className="flex items-center gap-2 pt-2">
            <Button onClick={handleSaveChannel} disabled={savingChannel} variant="secondary" size="sm">
              {savingChannel ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Channels
            </Button>
            <Button onClick={handleManualTrigger} disabled={triggering} variant="premium" size="sm">
              {triggering ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Send Latest Certificates
            </Button>
          </div>
        </div>
      </div>

      {/* Fake Certificate Auto-Poster */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-display font-semibold">Auto Certificate Poster</h3>
              <p className="text-sm text-muted-foreground">
                Posts randomly generated certificates to Discord at random intervals (30 min – 3 hrs).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="fake-toggle" className="text-xs text-muted-foreground">
              {fakeEnabled ? "Active" : "Off"}
            </Label>
            <Switch
              id="fake-toggle"
              checked={fakeEnabled}
              disabled={fakeToggling}
              onCheckedChange={async (checked) => {
                setFakeToggling(true);
                try {
                  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fake-cert-announce`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "toggle", enabled: checked }),
                  });
                  const data = await res.json();
                  setFakeEnabled(!!data.enabled);
                  toast({ title: data.enabled ? "Auto-poster enabled" : "Auto-poster disabled" });
                } catch (e) {
                  toast({ variant: "destructive", title: "Error", description: "Failed to toggle" });
                } finally {
                  setFakeToggling(false);
                }
              }}
            />
          </div>
        </div>

        {fakeLastRun && (
          <p className="text-xs text-muted-foreground">
            Last posted: {new Date(fakeLastRun).toLocaleString()}
          </p>
        )}
        {fakeNextRun && fakeEnabled && (
          <p className="text-xs text-muted-foreground">
            Next scheduled: {new Date(fakeNextRun).toLocaleString()}
          </p>
        )}

        <Button
          size="sm"
          variant="secondary"
          disabled={fakeSending}
          onClick={async () => {
            setFakeSending(true);
            try {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fake-cert-announce`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "send_now" }),
              });
              const data = await res.json();
              if (!res.ok || data?.error) throw new Error(data?.error || "Failed");
              setFakeLastRun(new Date().toISOString());
              setFakeNextRun(data.next_run || null);
              toast({
                title: "Fake certificate sent!",
                description: `Posted ${data.sent} (${data.type}) to Discord.`,
              });
            } catch (e) {
              toast({ variant: "destructive", title: "Error", description: e instanceof Error ? e.message : "Failed" });
            } finally {
              setFakeSending(false);
            }
          }}
        >
          {fakeSending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
          Send One Now
        </Button>
      </div>


      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-3">
          <DatabaseBackup className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-semibold">MongoDB Backup</h3>
            <p className="text-sm text-muted-foreground">
              Manually trigger a full backup of all 24 collections to the backup database. Runs automatically daily at midnight UTC.
            </p>
          </div>
        </div>
        <Button
          onClick={async () => {
            setBackingUp(true);
            try {
              const { data, error } = await supabase.functions.invoke("mongo-backup", { body: {} });
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              toast({
                title: "Backup complete",
                description: `Copied ${data.total_docs} documents across ${Object.keys(data.collections || {}).length} collections in ${data.elapsed_seconds}s.`,
              });
            } catch (e) {
              toast({
                variant: "destructive",
                title: "Backup failed",
                description: e instanceof Error ? e.message : "Unknown error",
              });
            } finally {
              setBackingUp(false);
            }
          }}
          disabled={backingUp}
          variant="secondary"
        >
          {backingUp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
          {backingUp ? "Backing up..." : "Backup Now"}
        </Button>
      </div>

      {/* Usage Info */}
      <div className="glass-panel p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm mb-1">How the Bot Works</h4>
              <p className="text-sm text-muted-foreground">
                In this setup, Discord calls your backend via the Interactions Endpoint URL.
                That means the bot responds via slash commands (use <code className="bg-muted px-1 rounded">/ask</code>).
                Mentions require an always-on bot host.
              </p>
          </div>
        </div>
      </div>
    </div>
  );
};
