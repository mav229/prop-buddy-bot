import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Coins, User, Zap } from "lucide-react";
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
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [monthData, setMonthData] = useState<Record<string, DayData>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalTotal, setGlobalTotal] = useState(0);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    fetchMonthData();
  }, [currentMonth]);

  const fetchMonthData = async () => {
    setLoading(true);
    try {
      const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

      // Fetch all daily cost entries for this month using the session key date,
      // not created_at (more reliable with upserts/timezone differences)
      const { data, error } = await supabase
        .from("session_cache")
        .select("session_id, email, context_json")
        .like("session_id", `__cost_daily__${monthPrefix}%`);

      if (error) throw error;

      // Also fetch global total
      const { data: globalData } = await supabase
        .from("session_cache")
        .select("context_json")
        .eq("session_id", "__global__")
        .eq("email", "__cost__")
        .maybeSingle();

      if (globalData) {
        setGlobalTotal((globalData.context_json as any)?.total ?? 0);
      }

      // Parse into day-based structure
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

      // Sort users by cost within each day
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

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <Coins className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Credit Usage</h2>
            <p className="text-muted-foreground">
              Total spent: <span className="text-foreground font-semibold">${globalTotal.toFixed(4)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6">
        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h3 className="text-lg font-semibold">{monthName}</h3>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for offset */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Day cells */}
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
                  onClick={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
                  className={cn(
                    "aspect-square rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 transition-all text-sm hover:border-border",
                    getCostColor(cost),
                    isToday && "ring-1 ring-foreground/30",
                    isSelected && "ring-2 ring-foreground"
                  )}
                >
                  <span className={cn("text-xs font-medium", isToday ? "text-foreground" : "text-muted-foreground")}>
                    {day}
                  </span>
                  {cost > 0 && (
                    <span className="text-[9px] font-mono text-foreground/70">
                      ${cost.toFixed(3)}
                    </span>
                  )}
                  {dayData && dayData.users.length > 0 && (
                    <div className="flex items-center gap-0.5">
                      <User className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-[8px] text-muted-foreground">{dayData.users.length}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/30">
          <span className="text-xs text-muted-foreground">Usage:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-500/15 border border-emerald-500/30" />
            <span className="text-[10px] text-muted-foreground">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40" />
            <span className="text-[10px] text-muted-foreground">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span className="text-[10px] text-muted-foreground">High</span>
          </div>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDayData && (
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {new Date(selectedDayData.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </h3>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" />${selectedDayData.totalCost.toFixed(4)}
              </span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5" />{selectedDayData.totalMessages} msgs
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {selectedDayData.users.map((user, i) => (
              <div
                key={user.email}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 border",
                  i === 0
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-border/30 bg-card/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0
                        ? "bg-amber-500/20 text-amber-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    #{i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">{user.email}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        {user.messages} msgs
                      </p>
                      <span className={cn(
                        "text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase",
                        user.source === "fullpage" ? "bg-blue-500/15 text-blue-400" :
                        user.source === "discord" ? "bg-purple-500/15 text-purple-400" :
                        "bg-emerald-500/15 text-emerald-400"
                      )}>
                        {user.source === "fullpage" ? "Dashboard" : user.source}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-semibold">${user.total.toFixed(4)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedDayData.totalCost > 0
                      ? `${Math.round((user.total / selectedDayData.totalCost) * 100)}% of day`
                      : "0%"}
                  </p>
                </div>
              </div>
            ))}

            {selectedDayData.users.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">No usage data for this day</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
