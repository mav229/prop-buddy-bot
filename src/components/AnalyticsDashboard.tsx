import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  MessageSquare,
  Database,
  Brain,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  Download,
  Globe,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Discord icon component
const DiscordIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
);

interface Stats {
  totalUsers: number;
  discordUsers: number;
  webSessions: number;
  totalMessages: number;
  discordMessages: number;
  webMessages: number;
  kbEntries: number;
  trainingFeedback: number;
  correctAnswers: number;
  pendingReviews: number;
}

interface DailyActivity {
  date: string;
  fullDate: string;
  discord: number;
  web: number;
  total: number;
}

interface CategoryData {
  name: string;
  value: number;
}

interface SourceData {
  name: string;
  value: number;
  color: string;
}

interface TopQuestion {
  question: string;
  count: number;
  source: string;
}

interface HourlyData {
  hour: string;
  discord: number;
  web: number;
}

const COLORS = {
  discord: "#5865F2",
  web: "#10b981",
  muted: "hsl(var(--muted-foreground))",
};

const PIE_COLORS = ["hsl(0, 0%, 90%)", "hsl(0, 0%, 75%)", "hsl(0, 0%, 60%)", "hsl(0, 0%, 45%)", "hsl(0, 0%, 30%)"];

export const AnalyticsDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    discordUsers: 0,
    webSessions: 0,
    totalMessages: 0,
    discordMessages: 0,
    webMessages: 0,
    kbEntries: 0,
    trainingFeedback: 0,
    correctAnswers: 0,
    pendingReviews: 0,
  });
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const isDiscordSession = (sessionId: string) => sessionId.startsWith("discord-user-");

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [usersRes, messagesRes, kbRes, feedbackRes] = await Promise.all([
        supabase.from("discord_users").select("*", { count: "exact" }),
        supabase.from("chat_history").select("*"),
        supabase.from("knowledge_base").select("*", { count: "exact" }),
        supabase.from("training_feedback").select("*"),
      ]);

      const messages = messagesRes.data || [];
      const feedback = feedbackRes.data || [];
      const correctCount = feedback.filter((f) => f.is_correct === true).length;
      const pendingCount = feedback.filter((f) => f.is_correct === null).length;

      // Separate Discord and Web messages
      const discordMsgs = messages.filter((m) => isDiscordSession(m.session_id));
      const webMsgs = messages.filter((m) => !isDiscordSession(m.session_id));

      // Count unique web sessions
      const webSessions = new Set(webMsgs.map((m) => m.session_id)).size;

      setStats({
        totalUsers: (usersRes.count || 0) + webSessions,
        discordUsers: usersRes.count || 0,
        webSessions,
        totalMessages: messages.length,
        discordMessages: discordMsgs.length,
        webMessages: webMsgs.length,
        kbEntries: kbRes.count || 0,
        trainingFeedback: feedback.length,
        correctAnswers: correctCount,
        pendingReviews: pendingCount,
      });

      // Source distribution pie chart
      setSourceData([
        { name: "Discord", value: discordMsgs.length, color: COLORS.discord },
        { name: "Web Widget", value: webMsgs.length, color: COLORS.web },
      ]);

      // Daily activity (last 14 days)
      const dailyMap: Record<string, { discord: number; web: number }> = {};
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split("T")[0];
        dailyMap[key] = { discord: 0, web: 0 };
      }

      messages.forEach((msg) => {
        const date = msg.created_at.split("T")[0];
        if (dailyMap[date]) {
          if (isDiscordSession(msg.session_id)) {
            dailyMap[date].discord++;
          } else {
            dailyMap[date].web++;
          }
        }
      });

      const dailyArr: DailyActivity[] = Object.entries(dailyMap).map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        fullDate: date,
        discord: counts.discord,
        web: counts.web,
        total: counts.discord + counts.web,
      }));
      setDailyActivity(dailyArr);

      // Hourly distribution
      const hourlyMap: Record<number, { discord: number; web: number }> = {};
      for (let i = 0; i < 24; i++) {
        hourlyMap[i] = { discord: 0, web: 0 };
      }

      messages.forEach((msg) => {
        const hour = new Date(msg.created_at).getHours();
        if (isDiscordSession(msg.session_id)) {
          hourlyMap[hour].discord++;
        } else {
          hourlyMap[hour].web++;
        }
      });

      const hourlyArr: HourlyData[] = Object.entries(hourlyMap).map(([hour, counts]) => ({
        hour: `${hour.padStart(2, "0")}:00`,
        discord: counts.discord,
        web: counts.web,
      }));
      setHourlyData(hourlyArr);

      // Top questions (user messages only)
      const userMessages = messages.filter((m) => m.role === "user");
      const questionCounts: Record<string, { count: number; source: string }> = {};
      
      userMessages.forEach((msg) => {
        const normalized = msg.content.toLowerCase().trim().slice(0, 100);
        const source = isDiscordSession(msg.session_id) ? "Discord" : "Web";
        if (!questionCounts[normalized]) {
          questionCounts[normalized] = { count: 0, source };
        }
        questionCounts[normalized].count++;
      });

      const topQ = Object.entries(questionCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([question, data]) => ({
          question: question.length > 60 ? question.slice(0, 60) + "..." : question,
          count: data.count,
          source: data.source,
        }));
      setTopQuestions(topQ);

      // KB categories for pie chart
      const { data: kbData } = await supabase.from("knowledge_base").select("category");
      if (kbData) {
        const catCounts: Record<string, number> = {};
        kbData.forEach((item) => {
          catCounts[item.category] = (catCounts[item.category] || 0) + 1;
        });
        setCategoryData(
          Object.entries(catCounts).map(([name, value]) => ({ name, value }))
        );
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("PropScholar Analytics Report", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
      
      // Summary Stats
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.text("Summary Statistics", 14, 45);
      
      autoTable(doc, {
        startY: 50,
        head: [["Metric", "Value"]],
        body: [
          ["Total Messages", stats.totalMessages.toString()],
          ["Discord Messages", stats.discordMessages.toString()],
          ["Web Messages", stats.webMessages.toString()],
          ["Discord Users", stats.discordUsers.toString()],
          ["Web Sessions", stats.webSessions.toString()],
          ["Knowledge Base Entries", stats.kbEntries.toString()],
          ["Training Feedback Items", stats.trainingFeedback.toString()],
          ["Correct Answers", stats.correctAnswers.toString()],
          ["Pending Reviews", stats.pendingReviews.toString()],
        ],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Daily Activity Table
      const finalY1 = (doc as any).lastAutoTable?.finalY || 50;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Daily Activity (Last 14 Days)", 14, finalY1 + 15);
      
      autoTable(doc, {
        startY: finalY1 + 20,
        head: [["Date", "Discord", "Web", "Total"]],
        body: dailyActivity.map((d) => [d.date, d.discord.toString(), d.web.toString(), d.total.toString()]),
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Top Questions
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Questions Asked", 14, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [["#", "Question", "Count", "Source"]],
        body: topQuestions.map((q, i) => [(i + 1).toString(), q.question, q.count.toString(), q.source]),
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
        columnStyles: { 1: { cellWidth: 100 } },
      });

      // Source Distribution
      const finalY2 = (doc as any).lastAutoTable?.finalY || 25;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Message Source Distribution", 14, finalY2 + 15);
      
      autoTable(doc, {
        startY: finalY2 + 20,
        head: [["Source", "Messages", "Percentage"]],
        body: sourceData.map((s) => [
          s.name,
          s.value.toString(),
          `${stats.totalMessages > 0 ? ((s.value / stats.totalMessages) * 100).toFixed(1) : 0}%`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Knowledge Base Categories
      if (categoryData.length > 0) {
        const finalY3 = (doc as any).lastAutoTable?.finalY || finalY2 + 20;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Knowledge Base by Category", 14, finalY3 + 15);
        
        autoTable(doc, {
          startY: finalY3 + 20,
          head: [["Category", "Entries"]],
          body: categoryData.map((c) => [c.name, c.value.toString()]),
          theme: "striped",
          headStyles: { fillColor: [50, 50, 50] },
        });
      }

      // Hourly Activity
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Hourly Activity Distribution", 14, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [["Hour", "Discord", "Web", "Total"]],
        body: hourlyData.map((h) => [h.hour, h.discord.toString(), h.web.toString(), (h.discord + h.web).toString()]),
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pageCount} | PropScholar Analytics`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      doc.save(`propscholar-analytics-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exported successfully!");
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      detail: `${stats.discordMessages} Discord, ${stats.webMessages} Web`,
    },
    {
      title: "Discord Users",
      value: stats.discordUsers,
      icon: Users,
      detail: "Active Discord members",
    },
    {
      title: "Web Sessions",
      value: stats.webSessions,
      icon: Globe,
      detail: "Unique widget visitors",
    },
    {
      title: "Knowledge Base",
      value: stats.kbEntries,
      icon: Database,
      detail: `${categoryData.length} categories`,
    },
    {
      title: "Training Items",
      value: stats.trainingFeedback,
      icon: Brain,
      detail: stats.pendingReviews > 0 ? `${stats.pendingReviews} pending` : "All reviewed",
    },
    {
      title: "Bot Accuracy",
      value: `${stats.trainingFeedback > 0 ? Math.round((stats.correctAnswers / stats.trainingFeedback) * 100) : 0}%`,
      icon: TrendingUp,
      detail: `${stats.correctAnswers}/${stats.trainingFeedback} correct`,
    },
  ];

  return (
    <div className="space-y-8" ref={chartRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
            <Activity className="w-6 h-6 text-background" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
            <p className="text-muted-foreground">Complete insights for Discord & Web channels</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={exportToPDF} disabled={exporting}>
            <Download className={`w-4 h-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
            {exporting ? "Exporting..." : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <div
              key={stat.title}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-5 transition-all hover:border-foreground/20 hover:bg-card"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.detail}</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                  <IconComponent className="w-4 h-4 text-foreground/70" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Source Distribution & Daily Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Source Distribution Pie */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Zap className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Message Sources</h3>
              <p className="text-xs text-muted-foreground">Discord vs Web</p>
            </div>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 space-y-2">
            {sourceData.map((source) => (
              <div key={source.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                  <span className="text-muted-foreground">{source.name}</span>
                </div>
                <span className="font-medium">{source.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Activity Chart - Takes 3 columns */}
        <div className="lg:col-span-3 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Activity className="w-4 h-4 text-foreground/70" />
              </div>
              <div>
                <h3 className="font-semibold">Daily Activity (Last 14 Days)</h3>
                <p className="text-xs text-muted-foreground">Messages by source over time</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.discord }} />
                <span className="text-muted-foreground">Discord</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.web }} />
                <span className="text-muted-foreground">Web</span>
              </div>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyActivity} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                  }}
                />
                <Bar dataKey="discord" stackId="a" fill={COLORS.discord} radius={[0, 0, 0, 0]} name="Discord" />
                <Bar dataKey="web" stackId="a" fill={COLORS.web} radius={[4, 4, 0, 0]} name="Web" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Hourly Distribution & Top Questions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Clock className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Hourly Activity</h3>
              <p className="text-xs text-muted-foreground">Peak usage times (UTC)</p>
            </div>
          </div>
          
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval={2}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                  }}
                />
                <Line type="monotone" dataKey="discord" stroke={COLORS.discord} strokeWidth={2} dot={false} name="Discord" />
                <Line type="monotone" dataKey="web" stroke={COLORS.web} strokeWidth={2} dot={false} name="Web" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Questions */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Top Questions</h3>
              <p className="text-xs text-muted-foreground">Most frequently asked</p>
            </div>
          </div>
          
          <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
            {topQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No questions yet</p>
            ) : (
              topQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-foreground/5 transition-colors">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{q.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-[10px] px-1.5 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: q.source === "Discord" ? `${COLORS.discord}20` : `${COLORS.web}20`,
                        color: q.source === "Discord" ? COLORS.discord : COLORS.web
                      }}
                    >
                      {q.source}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">×{q.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Knowledge Base & Training Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Knowledge Base Distribution */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Database className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">KB Distribution</h3>
              <p className="text-xs text-muted-foreground">By category</p>
            </div>
          </div>
          
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 space-y-2">
            {categoryData.slice(0, 5).map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="text-muted-foreground capitalize">{cat.name}</span>
                </div>
                <span className="font-medium">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Training Performance */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Brain className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Training Performance</h3>
              <p className="text-xs text-muted-foreground">Bot accuracy metrics</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-foreground/[0.02] border border-border/30">
              <p className="text-3xl font-bold">{stats.trainingFeedback}</p>
              <p className="text-sm text-muted-foreground mt-1">Total Tests</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-foreground/[0.02] border border-border/30">
              <p className="text-3xl font-bold">{stats.correctAnswers}</p>
              <p className="text-sm text-muted-foreground mt-1">Correct</p>
            </div>
            <div className="text-center p-4 rounded-xl bg-foreground/[0.02] border border-border/30">
              <p className="text-3xl font-bold">
                {stats.trainingFeedback > 0
                  ? Math.round((stats.correctAnswers / stats.trainingFeedback) * 100)
                  : 0}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Accuracy</p>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Accuracy Progress</span>
              <span>{stats.correctAnswers}/{stats.trainingFeedback}</span>
            </div>
            <div className="h-2 bg-foreground/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-foreground transition-all duration-500"
                style={{ 
                  width: `${stats.trainingFeedback > 0 ? (stats.correctAnswers / stats.trainingFeedback) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
          
          {stats.pendingReviews > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                <strong>{stats.pendingReviews}</strong> items pending review
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex items-center justify-between px-6 py-4 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last updated:</span>
            <span className="font-medium">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Data range:</span>
            <span className="font-medium">Last 14 days</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>All systems operational</span>
        </div>
      </div>
    </div>
  );
};
