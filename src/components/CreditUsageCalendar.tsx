import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Coins, User, Zap, Globe, MessageSquare, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DailyUserCost {
  email: string;
  total: number;
  messages: number;
  source: string;
}

interface DayData {
  date: string;
  users: DailyUserCost[];
  totalCost: number;
  totalMessages: number;
}

export const CreditUsageCalendar = () => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthData, setMonthData] = useState<Record<string, DayData>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(todayStr);
  const [loading, setLoading] = useState(true);
  const [globalTotal, setGlobalTotal] = useState(0);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  useEffect(() => {
    fetchMonthData();
  }, [currentMonth]);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

      const { data, error } = await supabase
        .from("session_cache")
        .select("session_id, email, context_json")
        .like("session_id", `__cost_daily__${monthPrefix}%`);

      if (error) throw error;

      const { data: globalData } = await supabase
        .from("session_cache")
        .select("context_json")
        .eq("session_id", "__global__")
        .eq("email", "__cost__")
        .maybeSingle();

      if (globalData) {
        setGlobalTotal((globalData.context_json as any)?.total ?? 0);
      }

      const dayMap: Record<string, DayData> = {};

      (data || []).forEach((row) => {
        const dateMatch = row.session_id.match(/__cost_daily__(\d{4}-\d{2}-\d{2})/);
        if (!dateMatch) return;
        const date = dateMatch[1];
        const ctx = row.context_json as any;

        if (!dayMap[date]) {
          dayMap[date] = { date, users: [], totalCost: 0, totalMessages: 0 };
        }

        const userCost: DailyUserCost = {
          email: row.email,
          total: ctx.total || 0,
          messages: ctx.messages || 0,
          source: ctx.source || "unknown",
        };

        dayMap[date].users.push(userCost);
        dayMap[date].totalCost += userCost.total;
        dayMap[date].totalMessages += userCost.messages;
      });

      Object.values(dayMap).forEach((day) => {
        day.users.sort((a, b) => b.total - a.total);
      });

      setMonthData(dayMap);
    } catch (err) {
      console.error("Error fetching credit data:", err);
      toast.error("Failed to load credit data");
    } finally {
      setLoading(false);
    }
  };

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const maxDayCost = useMemo(() => {
    return Math.max(...Object.values(monthData).map((d) => d.totalCost), 0.001);
  }, [monthData]);

  const selectedDayData = selectedDay ? monthData[selectedDay] : null;

  const getCostColor = (cost: number) => {
    if (cost === 0) return "";
    const intensity = Math.min(cost / maxDayCost, 1);
    if (intensity > 0.7) return "bg-red-500/30 border-red-500/50";
    if (intensity > 0.4) return "bg-amber-500/20 border-amber-500/40";
    return "bg-emerald-500/15 border-emerald-500/30";
  };

  const getSourceIcon = (source: string) => {
    if (source === "fullpage") return <Monitor className="w-3 h-3" />;
    if (source === "discord") return <MessageSquare className="w-3 h-3" />;
    return <Globe className="w-3 h-3" />;
  };

  const getSourceLabel = (source: string) => {
    if (source === "fullpage") return "Dashboard";
    if (source === "discord") return "Discord";
    return "Widget";
  };

  const getSourceStyle = (source: string) => {
    if (source === "fullpage") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    if (source === "discord") return "bg-purple-500/15 text-purple-400 border-purple-500/30";
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  };

  // Aggregate month totals by source
  const monthSourceTotals = useMemo(() => {
    const totals: Record<string, { cost: number; messages: number }> = {};
    Object.values(monthData).forEach((day) => {
      day.users.forEach((u) => {
        const label = getSourceLabel(u.source);
        if (!totals[label]) totals[label] = { cost: 0, messages: 0 };
        totals[label].cost += u.total;
        totals[label].messages += u.messages;
      });
    });
    return totals;
  }, [monthData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Credit Usage</h2>
            <p className="text-xs text-muted-foreground">
              Total: <span className="text-foreground font-semibold">${globalTotal.toFixed(4)}</span>
            </p>
          </div>
        </div>
        {/* Source breakdown pills */}
        <div className="flex items-center gap-2">
          {Object.entries(monthSourceTotals).map(([label, data]) => (
            <div key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/40 bg-card/50 text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold text-foreground">${data.cost.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Split layout: Calendar left, Users right */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* LEFT: Compact Calendar */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h3 className="text-sm font-semibold">{monthName}</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
              <div key={idx} className="text-center text-[10px] text-muted-foreground font-medium py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayData = monthData[dateStr];
                const cost = dayData?.totalCost || 0;
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDay;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(dateStr)}
                    className={cn(
                      "aspect-square rounded-lg border border-transparent flex flex-col items-center justify-center transition-all text-xs hover:border-border",
                      getCostColor(cost),
                      isToday && "ring-1 ring-foreground/30",
                      isSelected && "ring-2 ring-primary bg-primary/10"
                    )}
                  >
                    <span className={cn("text-[10px] font-medium", isToday ? "text-foreground" : "text-muted-foreground")}>
                      {day}
                    </span>
                    {cost > 0 && (
                      <span className="text-[8px] font-mono text-foreground/60">
                        ${cost < 0.01 ? cost.toFixed(3) : cost.toFixed(2)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-emerald-500/15 border border-emerald-500/30" />
              <span className="text-[9px] text-muted-foreground">Low</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/40" />
              <span className="text-[9px] text-muted-foreground">Med</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-red-500/30 border border-red-500/50" />
              <span className="text-[9px] text-muted-foreground">High</span>
            </div>
          </div>
        </div>

        {/* RIGHT: User breakdown */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-4">
          {selectedDayData ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">
                  {new Date(selectedDayData.date + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Coins className="w-3 h-3" />${selectedDayData.totalCost.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3" />{selectedDayData.totalMessages} msgs
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />{selectedDayData.users.length} users
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {selectedDayData.users.map((user, i) => (
                  <div
                    key={user.email + user.source}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2.5 border",
                      i === 0
                        ? "border-amber-500/30 bg-amber-500/5"
                        : "border-border/30 bg-card/30"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                          i === 0
                            ? "bg-amber-500/20 text-amber-500"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{user.email}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {user.messages} msgs
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border",
                            getSourceStyle(user.source)
                          )}>
                            {getSourceIcon(user.source)}
                            {getSourceLabel(user.source)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-mono font-semibold">${user.total.toFixed(4)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedDayData.totalCost > 0
                          ? `${Math.round((user.total / selectedDayData.totalCost) * 100)}%`
                          : "0%"}
                      </p>
                    </div>
                  </div>
                ))}

                {selectedDayData.users.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No usage data for this day</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <User className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Select a day to see email-by-email usage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
