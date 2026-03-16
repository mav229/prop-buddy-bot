import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Zap, Loader2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutoReply {
  id: string;
  trigger_keywords: string[];
  response_text: string;
  is_active: boolean;
  match_mode: string;
  priority: number;
  created_at: string;
}

export const AutoRepliesManager = () => {
  const [replies, setReplies] = useState<AutoReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // New reply form
  const [newKeywords, setNewKeywords] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [newMatchMode, setNewMatchMode] = useState("contains");
  const [newPriority, setNewPriority] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchReplies();
  }, []);

  const fetchReplies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("auto_replies" as any)
      .select("*")
      .order("priority", { ascending: false });
    if (error) {
      toast.error("Failed to load auto-replies");
    } else {
      setReplies((data as any) || []);
    }
    setLoading(false);
  };

  const addReply = async () => {
    const keywords = newKeywords.split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
    if (keywords.length === 0 || !newResponse.trim()) {
      toast.error("Please fill in keywords and response");
      return;
    }
    setAdding(true);
    const { error } = await supabase
      .from("auto_replies" as any)
      .insert({
        trigger_keywords: keywords,
        response_text: newResponse.trim(),
        match_mode: newMatchMode,
        priority: newPriority,
      } as any);
    if (error) {
      toast.error("Failed to add auto-reply");
    } else {
      toast.success("Auto-reply added!");
      setNewKeywords("");
      setNewResponse("");
      setNewPriority(0);
      fetchReplies();
    }
    setAdding(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    setSaving(id);
    const { error } = await supabase
      .from("auto_replies" as any)
      .update({ is_active: !current } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
    } else {
      setReplies(prev => prev.map(r => r.id === id ? { ...r, is_active: !current } : r));
    }
    setSaving(null);
  };

  const deleteReply = async (id: string) => {
    const { error } = await supabase
      .from("auto_replies" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setReplies(prev => prev.filter(r => r.id !== id));
      toast.success("Deleted!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Auto-Replies</h2>
          <p className="text-sm text-muted-foreground">
            Instant responses that bypass AI — zero credit cost
          </p>
        </div>
      </div>

      {/* Add new */}
      <div className="glass-panel p-5 space-y-4">
        <h3 className="font-semibold text-sm">Add New Auto-Reply</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Trigger Keywords (comma-separated)</label>
            <Input
              placeholder="refund, money back, cancel"
              value={newKeywords}
              onChange={e => setNewKeywords(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <label className="text-xs text-muted-foreground">Match Mode</label>
              <Select value={newMatchMode} onValueChange={setNewMatchMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="exact">Exact Match</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-20 space-y-2">
              <label className="text-xs text-muted-foreground">Priority</label>
              <Input type="number" value={newPriority} onChange={e => setNewPriority(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Response (supports markdown)</label>
          <Textarea
            placeholder="Here's our refund policy..."
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            rows={4}
          />
        </div>
        <Button onClick={addReply} disabled={adding} className="bg-foreground text-background hover:bg-foreground/90">
          {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Add Auto-Reply
        </Button>
      </div>

      {/* List */}
      {replies.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">No auto-replies yet</h3>
          <p className="text-muted-foreground text-sm">Add keyword triggers above to save AI credits.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {replies.map(reply => (
            <div key={reply.id} className="glass-panel p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {reply.trigger_keywords.map(kw => (
                      <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                    ))}
                    <Badge variant="secondary" className="text-[10px]">{reply.match_mode}</Badge>
                    {reply.priority > 0 && <Badge className="text-[10px] bg-amber-500/20 text-amber-600">P{reply.priority}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{reply.response_text}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(reply.id, reply.is_active)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    disabled={saving === reply.id}
                  >
                    {reply.is_active ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteReply(reply.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
