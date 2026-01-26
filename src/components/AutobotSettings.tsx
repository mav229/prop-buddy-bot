import { useState, useEffect } from "react";
import { Bot, Power, Clock, MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AutobotConfig {
  id: string;
  is_enabled: boolean;
  delay_seconds: number;
  bot_name: string;
  channels: string[];
}

export const AutobotSettings = () => {
  const [config, setConfig] = useState<AutobotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
          bot_name: data.bot_name || "PropScholar Assistant",
          channels: data.channels || [],
        });
      }
    } catch (error) {
      console.error("Error fetching autobot config:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load autobot settings",
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
        title: enabled ? "Autobot Enabled" : "Autobot Disabled",
        description: enabled 
          ? "The auto-reply bot will now respond to messages after the delay period."
          : "The auto-reply bot has been turned off.",
      });
    } catch (error) {
      console.error("Error toggling autobot:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update autobot status",
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
        description: "Autobot settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save autobot settings",
      });
    } finally {
      setSaving(false);
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
        <p>Schola settings not found. Please refresh the page.</p>
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
          <Bot className="w-5 h-5 text-accent" />
        </div>
        <div>
        <h2 className="font-display text-xl font-bold">Schola Auto-Reply</h2>
          <p className="text-sm text-muted-foreground">
          Friendly auto-replies after a delay (formerly "PS MOD Bot")
          </p>
        </div>
      </div>

      {/* Main Toggle */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Power className={`w-5 h-5 ${config.is_enabled ? "text-green-500" : "text-muted-foreground"}`} />
            <div>
              <h3 className="font-semibold">Schola Status</h3>
              <p className="text-sm text-muted-foreground">
                {config.is_enabled 
                  ? "Active - Auto-replying with warm, friendly tone" 
                  : "Inactive - Only @Scholaris AI responds"}
              </p>
            </div>
          </div>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <p className="text-xs text-muted-foreground">
            <strong>Discord Command:</strong> Use <code className="bg-background px-1 rounded">/autobot on</code> or <code className="bg-background px-1 rounded">/autobot off</code> in Discord to toggle Schola from the server.
          </p>
        </div>
      </div>

      {/* Settings */}
      <div className="glass-panel p-6 space-y-6">
        <h3 className="font-display font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Schola Configuration
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bot-name">Bot Display Name</Label>
            <Input
              id="bot-name"
              value={config.bot_name}
              onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
              placeholder="Schola"
            />
            <p className="text-xs text-muted-foreground">
              Used in AI prompt. Default: "Schola"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delay">Response Delay (seconds)</Label>
            <Input
              id="delay"
              type="number"
              min={30}
              max={600}
              value={config.delay_seconds}
              onChange={(e) => setConfig({ ...config, delay_seconds: parseInt(e.target.value) || 120 })}
            />
            <p className="text-xs text-muted-foreground">
              Wait this long before auto-replying, giving humans/mods time to respond first. (30-600 seconds)
            </p>
          </div>
        </div>

        <Button onClick={handleSaveSettings} disabled={saving} variant="premium">
          {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </div>

      {/* How it works */}
      <div className="glass-panel p-6">
          <div className="flex items-start gap-3 bg-muted/30 rounded-lg p-4 border border-primary/10">
            <MessageSquare className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
          <div>
              <h4 className="font-semibold text-sm mb-3">How Schola Auto-Reply Works</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Scholaris AI:</strong> Responds when @mentioned (always active, professional tone)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span><strong>Schola:</strong> Auto-replies to questions after {config.delay_seconds}s delay</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>If a human/mod replies first, Schola stays silent</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Toggle via this dashboard OR <code className="bg-background px-1.5 py-0.5 rounded text-xs">/autobot</code> in Discord</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Uses same knowledge base, but with warm, friendly "Yes sir!" tone</span>
                </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
