import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Clock, Zap, TrendingUp } from "lucide-react";

interface DailyStats {
  date: string;
  count: number;
  avg_time: number;
}

export const ExtensionAnalytics = () => {
  const [totalUsage, setTotalUsage] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from("extension_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!data) return;

      setTotalUsage(data.length);
      setRecentLogs(data.slice(0, 20));

      const times = data.filter(d => d.response_time_ms).map(d => d.response_time_ms!);
      setAvgResponseTime(times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0);

      const today = new Date().toISOString().split("T")[0];
      setTodayCount(data.filter(d => d.created_at.startsWith(today)).length);
    } catch (err) {
      console.error("Failed to fetch extension analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading analytics...</div>;
  }

  const successRate = recentLogs.length > 0
    ? Math.round((recentLogs.filter(l => l.success).length / recentLogs.length) * 100)
    : 100;

  // Tone distribution
  const toneDistribution: Record<string, number> = {};
  recentLogs.forEach(l => {
    if (l.tone_selected) {
      toneDistribution[l.tone_selected] = (toneDistribution[l.tone_selected] || 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Extension Analytics</h2>
        <p className="text-muted-foreground">Usage metrics for PropScholar Fix extension</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalUsage}</p>
                <p className="text-xs text-muted-foreground">Total Uses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{todayCount}</p>
                <p className="text-xs text-muted-foreground">Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{avgResponseTime}ms</p>
                <p className="text-xs text-muted-foreground">Avg Response</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(toneDistribution).length > 0 && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="text-sm">Tone Preference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(toneDistribution)
                .sort((a, b) => b[1] - a[1])
                .map(([tone, count]) => (
                  <div key={tone} className="bg-background rounded-lg px-4 py-2 border border-border/50">
                    <span className="text-sm font-medium">{tone}</span>
                    <span className="text-muted-foreground text-sm ml-2">{count}x</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage yet</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentLogs.slice(0, 15).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${log.success ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="text-muted-foreground">{log.input_length} chars</span>
                    {log.tone_selected && (
                      <span className="text-xs bg-card px-2 py-0.5 rounded border border-border/50">{log.tone_selected}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {log.response_time_ms && <span>{log.response_time_ms}ms</span>}
                    <span className="text-xs">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
