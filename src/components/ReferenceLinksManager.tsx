import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Link as LinkIcon, Save } from "lucide-react";
import { toast } from "sonner";

interface RefLink {
  id: string;
  title: string;
  url: string;
  keywords: string[];
  is_active: boolean;
  created_at: string;
}

export const ReferenceLinksManager = () => {
  const [links, setLinks] = useState<RefLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchLinks = async () => {
    const { data, error } = await supabase
      .from("mod_reference_links")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load reference links");
      console.error(error);
    } else {
      setLinks((data as unknown as RefLink[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, []);

  const addLink = async () => {
    if (!newTitle.trim() || !newUrl.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setSaving(true);
    const keywords = newKeywords.split(",").map(k => k.trim()).filter(Boolean);

    const { error } = await supabase.from("mod_reference_links").insert({
      title: newTitle.trim(),
      url: newUrl.trim(),
      keywords,
    } as any);

    if (error) {
      toast.error("Failed to add link");
      console.error(error);
    } else {
      toast.success("Link added");
      setNewTitle("");
      setNewUrl("");
      setNewKeywords("");
      fetchLinks();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("mod_reference_links")
      .update({ is_active: !current } as any)
      .eq("id", id);

    if (error) {
      toast.error("Failed to update");
    } else {
      setLinks(prev => prev.map(l => l.id === id ? { ...l, is_active: !current } : l));
    }
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase
      .from("mod_reference_links")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete");
    } else {
      setLinks(prev => prev.filter(l => l.id !== id));
      toast.success("Deleted");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Reference Links</h2>
        <p className="text-muted-foreground text-sm">
          Add links the AI will include in polished messages when keywords match.
        </p>
      </div>

      <Card className="border-border/50 bg-card/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Add New Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="Title (e.g. Server Rules)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <Input
              placeholder="URL (e.g. https://...)"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
            />
          </div>
          <Input
            placeholder="Keywords, comma-separated (e.g. rules, guidelines, conduct)"
            value={newKeywords}
            onChange={e => setNewKeywords(e.target.value)}
          />
          <Button onClick={addLink} disabled={saving} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Link
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : links.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reference links yet. Add one above.</p>
        ) : (
          links.map(link => (
            <Card key={link.id} className="border-border/50 bg-card/30">
              <CardContent className="py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium truncate">{link.title}</span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline truncate block"
                  >
                    {link.url}
                  </a>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {link.keywords.map((kw, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={() => toggleActive(link.id, link.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteLink(link.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
