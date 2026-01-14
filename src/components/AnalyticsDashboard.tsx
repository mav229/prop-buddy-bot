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
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Award,
  BarChart3,
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
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Discord icon component
const DiscordIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" fill="currentColor">
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
  avgResponseTime: number;
  engagementRate: number;
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
  trend: "up" | "down" | "stable";
}

interface HourlyData {
  hour: string;
  discord: number;
  web: number;
}

interface UserEngagement {
  name: string;
  value: number;
  fill: string;
}

const COLORS = {
  discord: "#5865F2",
  discordGlow: "#5865F240",
  web: "#10b981",
  webGlow: "#10b98140",
  accent: "#f59e0b",
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
    avgResponseTime: 1.2,
    engagementRate: 78,
  });
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [sourceData, setSourceData] = useState<SourceData[]>([]);
  const [discordQuestions, setDiscordQuestions] = useState<TopQuestion[]>([]);
  const [webQuestions, setWebQuestions] = useState<TopQuestion[]>([]);
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
      
      // Fetch data with increased limits (default is 1000)
      const [usersRes, messagesRes, kbRes, feedbackRes] = await Promise.all([
        supabase.from("discord_users").select("*", { count: "exact" }),
        supabase.from("chat_history").select("*").limit(10000),
        supabase.from("knowledge_base").select("*", { count: "exact" }),
        supabase.from("training_feedback").select("*").limit(5000),
      ]);

      const messages = messagesRes.data || [];
      const feedback = feedbackRes.data || [];
      const correctCount = feedback.filter((f) => f.is_correct === true).length;
      const pendingCount = feedback.filter((f) => f.is_correct === null).length;

      const discordMsgs = messages.filter((m) => isDiscordSession(m.session_id));
      const webMsgs = messages.filter((m) => !isDiscordSession(m.session_id));
      const webSessions = new Set(webMsgs.map((m) => m.session_id)).size;

      // Calculate engagement rate
      const userMessages = messages.filter(m => m.role === "user");
      const sessionsWithMultipleMessages = new Map<string, number>();
      userMessages.forEach(m => {
        sessionsWithMultipleMessages.set(m.session_id, (sessionsWithMultipleMessages.get(m.session_id) || 0) + 1);
      });
      const engagedSessions = Array.from(sessionsWithMultipleMessages.values()).filter(c => c > 1).length;
      const totalSessions = sessionsWithMultipleMessages.size;
      const engagementRate = totalSessions > 0 ? Math.round((engagedSessions / totalSessions) * 100) : 0;

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
        avgResponseTime: 1.2,
        engagementRate,
      });

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
        date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
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

      // Separate top questions for Discord and Web
      const discordUserMsgs = discordMsgs.filter((m) => m.role === "user");
      const webUserMsgs = webMsgs.filter((m) => m.role === "user");

      const getTopQuestions = (msgs: typeof messages): TopQuestion[] => {
        const questionCounts: Record<string, number> = {};
        msgs.forEach((msg) => {
          const normalized = msg.content.toLowerCase().trim().slice(0, 80);
          if (normalized.length > 3) {
            questionCounts[normalized] = (questionCounts[normalized] || 0) + 1;
          }
        });

        return Object.entries(questionCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([question, count]) => ({
            question: question.length > 50 ? question.slice(0, 50) + "..." : question,
            count,
            trend: count > 2 ? "up" : count === 1 ? "down" : "stable",
          }));
      };

      setDiscordQuestions(getTopQuestions(discordUserMsgs));
      setWebQuestions(getTopQuestions(webUserMsgs));

      // KB categories
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
      
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("PropScholar Analytics Report", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
      
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
          ["Bot Accuracy", `${stats.trainingFeedback > 0 ? Math.round((stats.correctAnswers / stats.trainingFeedback) * 100) : 0}%`],
          ["Engagement Rate", `${stats.engagementRate}%`],
        ],
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
      });

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

      // Discord Questions
      doc.addPage();
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Discord Questions", 14, 20);
      
      autoTable(doc, {
        startY: 25,
        head: [["#", "Question", "Count"]],
        body: discordQuestions.map((q, i) => [(i + 1).toString(), q.question, q.count.toString()]),
        theme: "striped",
        headStyles: { fillColor: [88, 101, 242] },
        columnStyles: { 1: { cellWidth: 120 } },
      });

      // Web Questions
      const finalY2 = (doc as any).lastAutoTable?.finalY || 25;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top Web Widget Questions", 14, finalY2 + 15);
      
      autoTable(doc, {
        startY: finalY2 + 20,
        head: [["#", "Question", "Count"]],
        body: webQuestions.map((q, i) => [(i + 1).toString(), q.question, q.count.toString()]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        columnStyles: { 1: { cellWidth: 120 } },
      });

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
        <div className="w-10 h-10 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const discordPercentage = stats.totalMessages > 0 ? Math.round((stats.discordMessages / stats.totalMessages) * 100) : 0;
  const webPercentage = stats.totalMessages > 0 ? Math.round((stats.webMessages / stats.totalMessages) * 100) : 0;

  return (
    <div className="space-y-6" ref={chartRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-foreground to-foreground/80 flex items-center justify-center shadow-lg">
            <BarChart3 className="w-7 h-7 text-background" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Analytics</h2>
            <p className="text-muted-foreground">Discord & Web performance insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={exportToPDF} disabled={exporting} className="bg-foreground text-background hover:bg-foreground/90">
            <Download className={`w-4 h-4 mr-2 ${exporting ? "animate-pulse" : ""}`} />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Discord Stats Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 border-2" style={{ borderColor: COLORS.discord, background: `linear-gradient(135deg, ${COLORS.discordGlow} 0%, transparent 100%)` }}>
          <div className="flex items-center gap-2 mb-3">
            <DiscordIcon className="w-5 h-5" style={{ color: COLORS.discord }} />
            <span className="text-sm font-semibold" style={{ color: COLORS.discord }}>Discord</span>
          </div>
          <p className="text-4xl font-bold tracking-tight">{stats.discordMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">messages • {stats.discordUsers} users</p>
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: COLORS.discord, color: "white" }}>
            {discordPercentage}%
          </div>
        </div>

        {/* Web Stats Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 border-2" style={{ borderColor: COLORS.web, background: `linear-gradient(135deg, ${COLORS.webGlow} 0%, transparent 100%)` }}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5" style={{ color: COLORS.web }} />
            <span className="text-sm font-semibold" style={{ color: COLORS.web }}>Web Widget</span>
          </div>
          <p className="text-4xl font-bold tracking-tight">{stats.webMessages}</p>
          <p className="text-xs text-muted-foreground mt-1">messages • {stats.webSessions} sessions</p>
          <div className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: COLORS.web, color: "white" }}>
            {webPercentage}%
          </div>
        </div>

        {/* Engagement Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 border border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-sm font-semibold text-orange-500">Engagement</span>
          </div>
          <p className="text-4xl font-bold tracking-tight">{stats.engagementRate}%</p>
          <p className="text-xs text-muted-foreground mt-1">multi-message sessions</p>
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: `linear-gradient(90deg, #f59e0b ${stats.engagementRate}%, transparent ${stats.engagementRate}%)` }} />
        </div>

        {/* Accuracy Card */}
        <div className="relative overflow-hidden rounded-2xl p-5 border border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5 text-purple-500" />
            <span className="text-sm font-semibold text-purple-500">Bot Accuracy</span>
          </div>
          <p className="text-4xl font-bold tracking-tight">
            {stats.trainingFeedback > 0 ? Math.round((stats.correctAnswers / stats.trainingFeedback) * 100) : 0}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">{stats.correctAnswers}/{stats.trainingFeedback} correct</p>
          {stats.pendingReviews > 0 && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-600">
              {stats.pendingReviews} pending
            </div>
          )}
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
          <p className="text-2xl font-bold">{stats.totalMessages}</p>
          <p className="text-xs text-muted-foreground">Total Messages</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
          <p className="text-2xl font-bold">{stats.totalUsers}</p>
          <p className="text-xs text-muted-foreground">Total Users</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
          <p className="text-2xl font-bold">{stats.kbEntries}</p>
          <p className="text-xs text-muted-foreground">KB Entries</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
          <p className="text-2xl font-bold">{categoryData.length}</p>
          <p className="text-xs text-muted-foreground">Categories</p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center">
              <Activity className="w-5 h-5 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">14-Day Activity</h3>
              <p className="text-xs text-muted-foreground">Messages by channel</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.discord }} />
              <span className="text-sm text-muted-foreground">Discord</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.web }} />
              <span className="text-sm text-muted-foreground">Web</span>
            </div>
          </div>
        </div>
        
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyActivity}>
              <defs>
                <linearGradient id="discordGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.discord} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={COLORS.discord} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="webGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.web} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={COLORS.web} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis 
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 10px 40px -10px rgba(0,0,0,0.3)",
                }}
              />
              <Area type="monotone" dataKey="discord" stroke={COLORS.discord} strokeWidth={2.5} fill="url(#discordGradient)" name="Discord" />
              <Area type="monotone" dataKey="web" stroke={COLORS.web} strokeWidth={2.5} fill="url(#webGradient)" name="Web" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TOP QUESTIONS - DISCORD & WEB SEPARATE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Discord Questions */}
        <div className="rounded-2xl border-2 p-6 relative overflow-hidden" style={{ borderColor: COLORS.discord, background: `linear-gradient(180deg, ${COLORS.discordGlow} 0%, transparent 30%)` }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLORS.discord }}>
              <DiscordIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Discord Questions</h3>
              <p className="text-xs text-muted-foreground">{discordQuestions.length} trending topics</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {discordQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No Discord questions yet</p>
            ) : (
              discordQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-all group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.discord}20`, color: COLORS.discord }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-clip">{q.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.trend === "up" && <ArrowUpRight className="w-3 h-3 text-green-500" />}
                    {q.trend === "down" && <ArrowDownRight className="w-3 h-3 text-red-400" />}
                    <span className="text-sm font-bold" style={{ color: COLORS.discord }}>×{q.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Web Questions */}
        <div className="rounded-2xl border-2 p-6 relative overflow-hidden" style={{ borderColor: COLORS.web, background: `linear-gradient(180deg, ${COLORS.webGlow} 0%, transparent 30%)` }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: COLORS.web }}>
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Web Widget Questions</h3>
              <p className="text-xs text-muted-foreground">{webQuestions.length} trending topics</p>
            </div>
          </div>
          
          <div className="space-y-2">
            {webQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No web questions yet</p>
            ) : (
              webQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-all group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${COLORS.web}20`, color: COLORS.web }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-clip">{q.question}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {q.trend === "up" && <ArrowUpRight className="w-3 h-3 text-green-500" />}
                    {q.trend === "down" && <ArrowDownRight className="w-3 h-3 text-red-400" />}
                    <span className="text-sm font-bold" style={{ color: COLORS.web }}>×{q.count}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Hourly Activity & KB Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Activity */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Clock className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Peak Hours</h3>
              <p className="text-xs text-muted-foreground">Activity distribution (UTC)</p>
            </div>
          </div>
          
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  interval={2}
                />
                <YAxis 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
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

        {/* Knowledge Base Distribution */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
              <Database className="w-4 h-4 text-foreground/70" />
            </div>
            <div>
              <h3 className="font-semibold">Knowledge Base</h3>
              <p className="text-xs text-muted-foreground">By category</p>
            </div>
          </div>
          
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={3}
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
          
          <div className="mt-3 space-y-1.5">
            {categoryData.slice(0, 4).map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground capitalize text-xs">{cat.name}</span>
                </div>
                <span className="font-medium text-xs">{cat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
          <span>•</span>
          <span>14-day rolling window</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-muted-foreground">Live</span>
        </div>
      </div>
    </div>
  );
};
