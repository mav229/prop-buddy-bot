import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Brain, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface TrainingItem {
  id: string;
  question: string;
  bot_answer: string;
  confidence: number;
  is_correct: boolean | null;
  corrected_answer: string | null;
  created_at: string;
}

export const TrainingCenter = () => {
  const [items, setItems] = useState<TrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("training_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      toast({ title: "Error fetching training data", description: error.message, variant: "destructive" });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleFeedback = async (id: string, isCorrect: boolean, correctedAnswer?: string) => {
    setSubmitting(id);
    
    const updateData: Record<string, unknown> = {
      is_correct: isCorrect,
      reviewed_at: new Date().toISOString(),
    };

    if (!isCorrect && correctedAnswer) {
      updateData.corrected_answer = correctedAnswer;
    }

    const { error } = await supabase
      .from("training_feedback")
      .update(updateData)
      .eq("id", id);

    if (error) {
      toast({ title: "Error saving feedback", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isCorrect ? "Marked as correct ✓" : "Correction saved" });
      setItems(prev => prev.map(item => 
        item.id === id 
          ? { ...item, is_correct: isCorrect, corrected_answer: correctedAnswer || null }
          : item
      ));
      setCorrections(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setSubmitting(null);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{(confidence * 100).toFixed(0)}%</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{(confidence * 100).toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{(confidence * 100).toFixed(0)}%</Badge>;
  };

  const getStatusBadge = (item: TrainingItem) => {
    if (item.is_correct === null) return <Badge variant="outline">Pending</Badge>;
    if (item.is_correct) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Correct</Badge>;
    return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Corrected</Badge>;
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
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Data Training Center</h2>
            <p className="text-sm text-muted-foreground">Review and correct bot responses to improve accuracy</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchItems} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="p-12 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No Training Data Yet</h3>
            <p className="text-muted-foreground">Chat interactions will appear here for review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="glass-panel overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                      {getConfidenceBadge(item.confidence)}
                      {getStatusBadge(item)}
                    </div>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Question:</CardTitle>
                    <p className="text-foreground mt-1">{item.question}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Bot Answer:</p>
                  <p className="text-sm">{item.bot_answer}</p>
                </div>

                {item.is_correct === false && item.corrected_answer && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs font-medium text-green-400 mb-1">Corrected Answer:</p>
                    <p className="text-sm text-green-300">{item.corrected_answer}</p>
                  </div>
                )}

                {item.is_correct === null && (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="If incorrect, enter the correct answer here..."
                      value={corrections[item.id] || ""}
                      onChange={(e) => setCorrections(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleFeedback(item.id, true)}
                        disabled={submitting === item.id}
                        className="gap-2 bg-green-600 hover:bg-green-700"
                      >
                        {submitting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Correct
                      </Button>
                      <Button
                        onClick={() => {
                          if (!corrections[item.id]?.trim()) {
                            toast({ title: "Please enter the correct answer first", variant: "destructive" });
                            return;
                          }
                          handleFeedback(item.id, false, corrections[item.id]);
                        }}
                        disabled={submitting === item.id}
                        variant="destructive"
                        className="gap-2"
                      >
                        {submitting === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                        Incorrect
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
