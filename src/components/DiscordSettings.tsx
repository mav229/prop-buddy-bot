import { useState } from "react";
import { Bot, ExternalLink, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export const DiscordSettings = () => {
  const [testMessage, setTestMessage] = useState("");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const { toast } = useToast();

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
