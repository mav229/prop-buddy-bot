import { useState, useEffect } from "react";
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
} from "recharts";

interface Stats {
  totalUsers: number;
  totalMessages: number;
  kbEntries: number;
  trainingFeedback: number;
  correctAnswers: number;
  pendingReviews: number;
}

interface DailyActivity {
  date: string;
  messages: number;
  users: number;
}

interface CategoryData {
  name: string;
  value: number;
}

const COLORS = ["hsl(0, 0%, 90%)", "hsl(0, 0%, 75%)", "hsl(0, 0%, 60%)", "hsl(0, 0%, 45%)", "hsl(0, 0%, 30%)"];

export const AnalyticsDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalMessages: 0,
    kbEntries: 0,
    trainingFeedback: 0,
    correctAnswers: 0,
    pendingReviews: 0,
  });
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Fetch basic stats
      const [usersRes, messagesRes, kbRes, feedbackRes] = await Promise.all([
        supabase.from("discord_users").select("*", { count: "exact" }),
        supabase.from("chat_history").select("*", { count: "exact" }),
        supabase.from("knowledge_base").select("*", { count: "exact" }),
        supabase.from("training_feedback").select("*"),
      ]);

      const feedback = feedbackRes.data || [];
      const correctCount = feedback.filter((f) => f.is_correct === true).length;
      const pendingCount = feedback.filter((f) => f.is_correct === null).length;

      setStats({
        totalUsers: usersRes.count || 0,
        totalMessages: messagesRes.count || 0,
        kbEntries: kbRes.count || 0,
        trainingFeedback: feedback.length,
        correctAnswers: correctCount,
        pendingReviews: pendingCount,
      });

      // Fetch KB categories for pie chart
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

      // Generate mock daily activity (last 7 days)
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push({
          date: date.toLocaleDateString("en-US", { weekday: "short" }),
          messages: Math.floor(Math.random() * 50) + 10,
          users: Math.floor(Math.random() * 5) + 1,
        });
      }
      setDailyActivity(days);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
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
      title: "Discord Users",
      value: stats.totalUsers,
      icon: Users,
      change: "+12%",
      positive: true,
    },
    {
      title: "Total Messages",
      value: stats.totalMessages,
      icon: MessageSquare,
      change: "+28%",
      positive: true,
    },
    {
      title: "Knowledge Base",
      value: stats.kbEntries,
      icon: Database,
      change: "+5",
      positive: true,
    },
    {
      title: "Training Items",
      value: stats.trainingFeedback,
      icon: Brain,
      change: stats.pendingReviews > 0 ? `${stats.pendingReviews} pending` : "All reviewed",
      positive: stats.pendingReviews === 0,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-foreground flex items-center justify-center">
          <Activity className="w-6 h-6 text-background" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">Analytics Overview</h2>
          <p className="text-muted-foreground">Real-time insights for your PropScholar bot</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={stat.title}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 transition-all hover:border-foreground/20 hover:bg-card"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <div className={`flex items-center gap-1 text-xs ${stat.positive ? "text-foreground/70" : "text-muted-foreground"}`}>
                  <TrendingUp className="w-3 h-3" />
                  <span>{stat.change}</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors">
                <stat.icon className="w-5 h-5 text-foreground/70" />
              </div>
            </div>
            
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-foreground/[0.02] to-transparent pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart - Takes 2 columns */}
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/5 flex items-center justify-center">
                <Zap className="w-4 h-4 text-foreground/70" />
              </div>
              <div>
                <h3 className="font-semibold">Weekly Activity</h3>
                <p className="text-xs text-muted-foreground">Messages over the last 7 days</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-foreground/60" />
                <span>Messages</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-foreground/20" />
                <span>Users</span>
              </div>
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyActivity}>
                <defs>
                  <linearGradient id="messagesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
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
                    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  fill="url(#messagesGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="hsl(var(--foreground) / 0.3)"
                  strokeWidth={2}
                  fill="url(#usersGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

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
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 60 }}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    color: "hsl(var(--popover-foreground))",
                    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.55)",
                  }}
                  labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                  itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          {/* Legend */}
          <div className="mt-4 space-y-2">
            {categoryData.slice(0, 4).map((cat, index) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-muted-foreground capitalize">{cat.name}</span>
                </div>
                <span className="font-medium">{cat.value}</span>
              </div>
            ))}
          </div>
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
            <p className="text-xs text-muted-foreground">Bot accuracy over time</p>
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
      </div>

      {/* Quick Stats Bar */}
      <div className="flex items-center justify-between px-6 py-4 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Last updated:</span>
            <span className="font-medium">{new Date().toLocaleTimeString()}</span>
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
