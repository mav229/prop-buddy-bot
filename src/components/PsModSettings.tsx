import { useState, useEffect } from "react";
import { Bot, Power, Clock, MessageSquare, Loader2, RefreshCw, Shield, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PsModConfig {
  id: string;
  is_enabled: boolean;
  delay_seconds: number;
  bot_name: string;
}

export const PsModSettings = () => {
  const [config, setConfig] = useState<PsModConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testQuestion, setTestQuestion] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ps_mod_settings")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setConfig({
          id: data.id,
          is_enabled: data.is_enabled,
          delay_seconds: data.delay_seconds,
          bot_name: data.bot_name || "PS MOD",
        });
      }
    } catch (error) {
      console.error("Error fetching PS MOD config:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load PS MOD settings",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggle = async (enabled: boolean) => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ps_mod_settings")
        .update({ is_enabled: enabled })
        .eq("id", config.id);

      if (error) throw error;

      setConfig({ ...config, is_enabled: enabled });
      toast({
        title: enabled ? "PS MOD Enabled" : "PS MOD Disabled",
        description: enabled 
          ? "PS MOD will now respond to unanswered questions."
          : "PS MOD has been turned off.",
      });
    } catch (error) {
      console.error("Error toggling PS MOD:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update PS MOD status",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("ps_mod_settings")
        .update({
          delay_seconds: config.delay_seconds,
          bot_name: config.bot_name,
        })
        .eq("id", config.id);

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "PS MOD settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save PS MOD settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSchola = async () => {
    if (!testQuestion.trim()) {
      toast({
        variant: "destructive",
        title: "Empty question",
        description: "Please enter a question to test.",
      });
      return;
    }

    setTesting(true);
    setTestResponse("");
    
    try {
      const { data, error } = await supabase.functions.invoke("discord-bot", {
        body: {
          message: testQuestion,
          channelId: "test-arena",
          username: "TestUser",
          displayName: "Test User",
          mode: "ps-mod",
          systemPromptOverride: `You are Schola, a sharp and friendly helper in the PropScholar Discord community.

PERSONALITY:
- You sound like a smart, chill human - NOT a robotic AI
- Keep it real, keep it short, keep it helpful
- Use casual language but stay professional
- 1-2 emojis max, only when natural
- Never start with "I" - vary your openings

RESPONSE STYLE:
- SHORT answers (2-4 sentences max)
- Get straight to the point
- If they need more detail, tell them to tag @Scholaris for the full breakdown
- Sound confident but not arrogant

RULES:
- For complex stuff: "Tag @Scholaris for the deep dive on this 🎯"
- For issues/problems: "Hit up support@propscholar.com and they'll sort you out"
- Never say "I'm an AI" or "As an AI" - you're just a helpful community member
- Don't over-explain, don't be preachy
- React naturally - like a human would`,
        },
      });

      if (error) throw error;

      setTestResponse(data.response || "No response received");
    } catch (error) {
      console.error("Error testing Schola:", error);
      toast({
        variant: "destructive",
        title: "Test failed",
        description: "Could not get response from Schola.",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>PS MOD settings not found. Database may need setup.</p>
        <Button onClick={fetchConfig} variant="outline" className="mt-4">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Schola Bot</h2>
          <p className="text-sm text-muted-foreground">
            Separate auto-reply bot for unanswered questions
          </p>
        </div>
      </div>

      {/* Main Toggle */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${config.is_enabled ? "text-success" : "text-muted-foreground"}`} />
            <div>
              <h3 className="font-semibold">Schola Status</h3>
              <p className="text-sm text-muted-foreground">
                {config.is_enabled 
                  ? "Active - responding to unanswered questions" 
                  : "Inactive - not responding automatically"}
              </p>
            </div>
          </div>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
          <p className="text-xs text-muted-foreground">
            <strong>Separate Bot:</strong> Schola runs independently from Scholaris with its own token and deployment.
          </p>
        </div>
      </div>

      {/* Settings */}
      <div className="glass-panel p-6 space-y-6">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Configuration
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ps-mod-name">Bot Display Name</Label>
            <Input
              id="ps-mod-name"
              value={config.bot_name}
              onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
              placeholder="PS MOD"
            />
            <p className="text-xs text-muted-foreground">
              Used in AI prompts for personality context.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ps-mod-delay">Response Delay (seconds)</Label>
            <Input
              id="ps-mod-delay"
              type="number"
              min={30}
              max={600}
              value={config.delay_seconds}
              onChange={(e) => setConfig({ ...config, delay_seconds: parseInt(e.target.value) || 120 })}
            />
            <p className="text-xs text-muted-foreground">
              Default: 120 seconds (2 minutes). Wait this long before responding.
            </p>
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={saving} variant="premium">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* Test Arena */}
      <div className="glass-panel p-6 space-y-4">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          Test Arena
        </h3>
        <p className="text-sm text-muted-foreground">
          Test Schola's responses before deploying. This simulates how Schola would respond to a question.
        </p>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="test-question">Test Question</Label>
            <Textarea
              id="test-question"
              placeholder="e.g., What's the best prop firm for beginners?"
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              rows={2}
            />
          </div>
          
          <Button 
            onClick={handleTestSchola} 
            disabled={testing || !testQuestion.trim()}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Thinking...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Test Schola Response
              </>
            )}
          </Button>
          
          {testResponse && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Schola's Response:</p>
              <p className="text-sm">{testResponse}</p>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="glass-panel p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm mb-2">Schola vs Scholaris</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• <strong>Scholaris:</strong> Responds when @mentioned (always active)</li>
              <li>• <strong>Schola:</strong> Responds to ANY question after {config.delay_seconds}s delay</li>
              <li>• Both bots use the same knowledge base</li>
              <li>• Schola has its own token and Railway deployment</li>
              <li>• If a human replies during the delay, Schola stays quiet</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
