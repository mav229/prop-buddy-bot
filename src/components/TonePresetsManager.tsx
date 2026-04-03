import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface TonePreset {
  id: string;
  name: string;
  description: string | null;
  prompt_instructions: string;
  is_active: boolean;
  sort_order: number;
}

export const TonePresetsManager = () => {
  const [presets, setPresets] = useState<TonePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newInstructions, setNewInstructions] = useState("");

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const { data, error } = await supabase
        .from("extension_tone_presets")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      setPresets((data as TonePreset[]) || []);
    } catch (err) {
      console.error("Failed to fetch tone presets:", err);
    } finally {
      setLoading(false);
    }
  };

  const addPreset = async () => {
    if (!newName.trim() || !newInstructions.trim()) {
      toast.error("Name and instructions are required");
      return;
    }

    try {
      const { error } = await supabase.from("extension_tone_presets").insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        prompt_instructions: newInstructions.trim(),
        sort_order: presets.length,
      });
      if (error) throw error;
      toast.success("Tone preset added");
      setNewName("");
      setNewDesc("");
      setNewInstructions("");
      fetchPresets();
    } catch (err: any) {
      toast.error(err.message || "Failed to add preset");
    }
  };

  const togglePreset = async (id: string, is_active: boolean) => {
    try {
      const { error } = await supabase
        .from("extension_tone_presets")
        .update({ is_active: !is_active })
        .eq("id", id);
      if (error) throw error;
      setPresets(prev => prev.map(p => p.id === id ? { ...p, is_active: !is_active } : p));
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const deletePreset = async (id: string) => {
    try {
      const { error } = await supabase
        .from("extension_tone_presets")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Preset deleted");
      setPresets(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Tone Presets</h3>
        <p className="text-sm text-muted-foreground">Configure AI response tones for the extension (max 5 active)</p>
      </div>

      <div className="space-y-3">
        {presets.map((preset) => (
          <Card key={preset.id} className={`bg-card/50 border-border/50 ${!preset.is_active ? "opacity-50" : ""}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium">{preset.name}</div>
                    {preset.description && <div className="text-xs text-muted-foreground mt-0.5">{preset.description}</div>}
                    <div className="text-xs text-muted-foreground mt-1 bg-background/50 rounded px-2 py-1 border border-border/30">
                      {preset.prompt_instructions}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={preset.is_active} onCheckedChange={() => togglePreset(preset.id, preset.is_active)} />
                  <Button variant="ghost" size="icon" onClick={() => deletePreset(preset.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card/30 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Add New Tone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Tone name (e.g. Formal Warning)" value={newName} onChange={e => setNewName(e.target.value)} />
          <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <Textarea
            placeholder="AI prompt instructions (e.g. Rewrite as a formal warning — stern but professional)"
            value={newInstructions}
            onChange={e => setNewInstructions(e.target.value)}
            rows={3}
          />
          <Button onClick={addPreset} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Add Tone Preset
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
