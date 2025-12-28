import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, Brain, RefreshCw, Send, MessageSquare } from "lucide-react";
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
  
  // Test bot state
  const [testQuestion, setTestQuestion] = useState("");
  const [testAnswer, setTestAnswer] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testItemId, setTestItemId] = useState<string | null>(null);
  const [testCorrection, setTestCorrection] = useState("");

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

  const handleTestQuestion = async () => {
    if (!testQuestion.trim()) return;
    
    setTestLoading(true);
    setTestAnswer("");
    setTestItemId(null);
    setTestCorrection("");

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: testQuestion }],
          sessionId: `test-${Date.now()}`,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  fullAnswer += content;
                  setTestAnswer(fullAnswer);
                }
              } catch {}
            }
          }
        }
      }

      // Save to training_feedback for review
      const { data: insertedData, error } = await supabase
        .from("training_feedback")
        .insert({
          question: testQuestion,
          bot_answer: fullAnswer,
          confidence: 0.85,
          session_id: `test-${Date.now()}`,
        })
        .select()
        .single();

      if (error) {
        console.error("Error saving test:", error);
      } else if (insertedData) {
        setTestItemId(insertedData.id);
      }

    } catch (error) {
      toast({ title: "Error testing bot", description: String(error), variant: "destructive" });
    }
    
    setTestLoading(false);
  };

  const handleTestFeedback = async (isCorrect: boolean) => {
    if (!testItemId) return;
    
    setSubmitting(testItemId);
    
    const updateData: Record<string, unknown> = {
      is_correct: isCorrect,
      reviewed_at: new Date().toISOString(),
    };

    if (!isCorrect && testCorrection.trim()) {
      updateData.corrected_answer = testCorrection;
    }

    const { error } = await supabase
      .from("training_feedback")
      .update(updateData)
      .eq("id", testItemId);

    if (error) {
      toast({ title: "Error saving feedback", description: error.message, variant: "destructive" });
    } else {
      toast({ title: isCorrect ? "Marked as correct ✓" : "Correction saved" });
      // Reset test state
      setTestQuestion("");
      setTestAnswer("");
      setTestItemId(null);
      setTestCorrection("");
      // Refresh the list
      fetchItems();
    }
    setSubmitting(null);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Data Training Center</h2>
            <p className="text-sm text-muted-foreground">Test and train the bot by asking questions</p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchItems} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Test Bot Section */}
      <Card className="glass-panel border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Test Bot</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Ask a question and mark the response as correct or incorrect</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Type a question to test the bot..."
              value={testQuestion}
              onChange={(e) => setTestQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !testLoading && handleTestQuestion()}
              disabled={testLoading}
              className="flex-1"
            />
            <Button 
              onClick={handleTestQuestion} 
              disabled={testLoading || !testQuestion.trim()}
              className="gap-2"
            >
              {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Ask
            </Button>
          </div>

          {(testLoading || testAnswer) && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-medium text-muted-foreground mb-2">Bot Response:</p>
              <p className="text-sm whitespace-pre-wrap">{testAnswer || "Thinking..."}</p>
              {testLoading && <Loader2 className="w-4 h-4 animate-spin mt-2" />}
            </div>
          )}

          {testAnswer && testItemId && (
            <div className="space-y-3 pt-2 border-t border-border/50">
              <Textarea
                placeholder="If incorrect, enter the correct answer here..."
                value={testCorrection}
                onChange={(e) => setTestCorrection(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => handleTestFeedback(true)}
                  disabled={submitting === testItemId}
                  className="gap-2 bg-green-600 hover:bg-green-700"
                >
                  {submitting === testItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Correct
                </Button>
                <Button
                  onClick={() => {
                    if (!testCorrection.trim()) {
                      toast({ title: "Please enter the correct answer first", variant: "destructive" });
                      return;
                    }
                    handleTestFeedback(false);
                  }}
                  disabled={submitting === testItemId}
                  variant="destructive"
                  className="gap-2"
                >
                  {submitting === testItemId ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Incorrect
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training History */}
      <div className="pt-4">
        <h3 className="text-lg font-semibold mb-4">Training History</h3>
        
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="glass-panel">
            <CardContent className="p-12 text-center">
              <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No Training Data Yet</h3>
              <p className="text-muted-foreground">Use the test bot above to start training</p>
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
    </div>
  );
};