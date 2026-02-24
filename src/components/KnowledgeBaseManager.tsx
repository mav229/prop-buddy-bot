import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Edit2, Save, X, Book, Loader2, Globe, Search, ArrowUpDown, Filter, FileDown } from "lucide-react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
// CSV export utility
function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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

type SortField = "title" | "category" | "created_at" | "updated_at";
type SortOrder = "asc" | "desc";

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

  // Sorting & filtering state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Scraping state
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<{
    title: string;
    content: string;
    url: string;
  } | null>(null);

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

  // Filtered and sorted entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.content.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter((e) => e.category === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === "created_at" || sortField === "updated_at") {
        aVal = new Date(aVal).getTime().toString();
        bVal = new Date(bVal).getTime().toString();
      }

      const comparison = aVal.localeCompare(bVal);
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [entries, searchQuery, filterCategory, sortField, sortOrder]);

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;

    setScraping(true);
    setScrapedContent(null);

    try {
      const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
        body: { url: scrapeUrl },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Scraping failed');
      }

      const markdown = data.data?.markdown || data.markdown || '';
      const metadata = data.data?.metadata || data.metadata || {};
      
      setScrapedContent({
        title: metadata.title || scrapeUrl,
        content: markdown,
        url: scrapeUrl,
      });

      toast({ title: "Website scraped successfully!" });
    } catch (err) {
      console.error("Error scraping:", err);
      toast({
        variant: "destructive",
        title: "Scraping failed",
        description: err instanceof Error ? err.message : "Failed to scrape website",
      });
    } finally {
      setScraping(false);
    }
  };

  const handleAddScrapedContent = () => {
    if (!scrapedContent) return;
    
    setFormData({
      title: scrapedContent.title,
      content: scrapedContent.content,
      category: "general",
    });
    setScrapedContent(null);
    setScrapeUrl("");
    setShowForm(true);
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleExportPDF = () => {
    const rows: string[][] = [
      ["PropScholar Knowledge Base"],
      [`Exported on ${new Date().toLocaleDateString()} • ${entries.length} entries`],
      [],
      ["Category", "Title", "Content"],
      ...entries.map(e => [e.category, e.title, e.content]),
    ];
    downloadCSV("propscholar-knowledge-base.csv", rows);
    toast({ title: "CSV exported!", description: "Knowledge base downloaded successfully." });
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Book className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold">Knowledge Base</h2>
            <p className="text-sm text-muted-foreground">
              {filteredEntries.length} of {entries.length} entries
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportPDF} size="sm">
            <FileDown className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          {!showForm && (
            <Button variant="premium" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4" />
              Add Entry
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="entries" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="entries">Entries</TabsTrigger>
          <TabsTrigger value="scrape">
            <Globe className="w-4 h-4 mr-2" />
            Scrape Website
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scrape" className="space-y-4">
          <div className="glass-panel p-6 space-y-4">
            <div>
              <h3 className="font-display font-semibold mb-2">Scrape Website Content</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enter a URL to scrape content and add it to the knowledge base.
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="flex-1"
              />
              <Button
                onClick={handleScrape}
                disabled={scraping || !scrapeUrl.trim()}
                variant="premium"
              >
                {scraping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4" />
                    Scrape
                  </>
                )}
              </Button>
            </div>

            {scrapedContent && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{scrapedContent.title}</h4>
                  <Button
                    size="sm"
                    variant="premium"
                    onClick={handleAddScrapedContent}
                  >
                    <Plus className="w-4 h-4" />
                    Add to Knowledge Base
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{scrapedContent.url}</p>
                <div className="max-h-64 overflow-auto text-sm bg-background p-3 rounded border">
                  <pre className="whitespace-pre-wrap font-sans">{scrapedContent.content.slice(0, 2000)}...</pre>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="entries" className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="glass-panel p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entries..."
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2">
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1).replace("-", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={`${sortField}-${sortOrder}`}
                  onValueChange={(val) => {
                    const [field, order] = val.split("-") as [SortField, SortOrder];
                    setSortField(field);
                    setSortOrder(order);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at-desc">Newest First</SelectItem>
                    <SelectItem value="updated_at-asc">Oldest First</SelectItem>
                    <SelectItem value="title-asc">Title A-Z</SelectItem>
                    <SelectItem value="title-desc">Title Z-A</SelectItem>
                    <SelectItem value="category-asc">Category A-Z</SelectItem>
                    <SelectItem value="category-desc">Category Z-A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                  rows={8}
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

          {filteredEntries.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-lg font-semibold mb-2">
                {entries.length === 0 ? "No entries yet" : "No matching entries"}
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                {entries.length === 0
                  ? "Add knowledge base entries to help PropScholar AI answer questions."
                  : "Try adjusting your search or filters."}
              </p>
              {entries.length === 0 && (
                <Button variant="premium" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4" />
                  Add First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredEntries.map((entry) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
