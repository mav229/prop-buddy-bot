import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Save, X, Book, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "general",
  "evaluations",
  "rules",
  "payouts",
  "accounts",
  "drawdown",
  "dashboard",
  "trading",
  "scholar-score",
];

export const KnowledgeBaseManager = () => {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from("knowledge_base")
        .select("*")
        .order("category")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEntries(data || []);
    } catch (err) {
      console.error("Error fetching entries:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load knowledge base entries.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("knowledge_base")
          .update({
            title: formData.title,
            content: formData.content,
            category: formData.category,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast({ title: "Entry updated successfully" });
      } else {
        const { error } = await supabase.from("knowledge_base").insert({
          title: formData.title,
          content: formData.content,
          category: formData.category,
        });

        if (error) throw error;
        toast({ title: "Entry added successfully" });
      }

      setFormData({ title: "", content: "", category: "general" });
      setEditingId(null);
      setShowForm(false);
      fetchEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save entry. Make sure you have admin permissions.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setFormData({
      title: entry.title,
      content: entry.content,
      category: entry.category,
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    try {
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Entry deleted successfully" });
      fetchEntries();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete entry.",
      });
    }
  };

  const handleCancel = () => {
    setFormData({ title: "", content: "", category: "general" });
    setEditingId(null);
    setShowForm(false);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Book className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground">
              {entries.length} entries
            </p>
          </div>
        </div>

        {!showForm && (
          <Button variant="premium" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Add Entry
          </Button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-semibold">
              {editingId ? "Edit Entry" : "New Entry"}
            </h3>
            <Button type="button" variant="ghost" size="icon" onClick={handleCancel}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="e.g., Drawdown Rules"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Enter the knowledge base content..."
              rows={6}
              required
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="premium" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <Save className="w-4 h-4" />
              {editingId ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">
            No entries yet
          </h3>
          <p className="text-muted-foreground text-sm mb-4">
            Add knowledge base entries to help PropScholar AI answer questions.
          </p>
          <Button variant="premium" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" />
            Add First Entry
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="glass-panel p-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full font-medium">
                      {entry.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-display font-semibold text-foreground mb-2">
                    {entry.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {entry.content}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(entry)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(entry.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
