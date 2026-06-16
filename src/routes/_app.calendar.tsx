import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { SPORT_LABELS, FATIGUE_LABELS, EMOJI_SCALE } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface DayLog {
  id: string;
  exercise_name: string;
  planned_sets: number;
  planned_reps: number;
  planned_weight: number;
  actual_sets: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  completed: boolean;
}

function CalendarPage() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [logCounts, setLogCounts] = useState<Record<string, number>>({});
  const [comps, setComps] = useState<Array<{ date: string; name: string }>>([]);
  const [selected, setSelected] = useState<string>(fmt(new Date()));
  const [selectedLogs, setSelectedLogs] = useState<DayLog[]>([]);
  const [selectedCheckin, setSelectedCheckin] = useState<{ sport: number; fatigue: number } | null>(
    null,
  );
  const [trend, setTrend] = useState<{ date: string; sport: number; fatigue: number }[]>([]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDow = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Load month aggregates
  useEffect(() => {
    if (!user) return;
    const start = fmt(new Date(year, month, 1));
    const end = fmt(new Date(year, month + 1, 0));
    (async () => {
      const [l, cm] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("date, completed")
          .eq("athlete_id", user.id)
          .gte("date", start)
          .lte("date", end),
        supabase
          .from("competitions")
          .select("competition_date, competition_name")
          .eq("athlete_id", user.id)
          .gte("competition_date", start)
          .lte("competition_date", end),
      ]);
      const lm: Record<string, number> = {};
      (l.data ?? []).forEach((r: any) => {
        if (r.completed) lm[r.date] = (lm[r.date] ?? 0) + 1;
      });
      setLogCounts(lm);
      setComps(
        (cm.data ?? []).map((r: any) => ({
          date: r.competition_date,
          name: r.competition_name,
        })),
      );
    })();
  }, [user, year, month]);

  // Trend (last 30 days)
  useEffect(() => {
    if (!user) return;
    (async () => {
      const since = new Date();
      since.setDate(since.getDate() - 29);
      const { data } = await supabase
        .from("daily_checkins")
        .select("date, sport_intensity, fatigue_level")
        .eq("athlete_id", user.id)
        .gte("date", fmt(since))
        .order("date");
      setTrend(
        (data ?? []).map((r: any) => ({
          date: r.date.slice(5),
          sport: r.sport_intensity,
          fatigue: r.fatigue_level,
        })),
      );
    })();
  }, [user]);

  // Load selected day detail
  useEffect(() => {
    if (!user || !selected) return;
    (async () => {
      const [l, c] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("*")
          .eq("athlete_id", user.id)
          .eq("date", selected)
          .order("created_at"),
        supabase
          .from("daily_checkins")
          .select("sport_intensity, fatigue_level")
          .eq("athlete_id", user.id)
          .eq("date", selected)
          .maybeSingle(),
      ]);
      setSelectedLogs((l.data ?? []) as DayLog[]);
      setSelectedCheckin(
        c.data ? { sport: c.data.sport_intensity, fatigue: c.data.fatigue_level } : null,
      );
    })();
  }, [user, selected]);

  const todayStr = fmt(new Date());
  const selectedComps = comps.filter((c) => c.date === selected);

  // Trend averages
  const avgSport = trend.length
    ? (trend.reduce((a, b) => a + b.sport, 0) / trend.length).toFixed(1)
    : "—";
  const avgFatigue = trend.length
    ? (trend.reduce((a, b) => a + b.fatigue, 0) / trend.length).toFixed(1)
    : "—";
  const highFatigueDays = trend.filter((t) => t.fatigue >= 4).length;

  return (
    <div className="container-mobile py-6 pb-24">
      <h1 className="text-2xl font-bold">기록</h1>

      {/* Calendar */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="rounded-lg border border-border p-2"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-lg font-bold">
          {year}년 <span className="text-primary">{month + 1}월</span>
        </h2>
        <button
          onClick={() => setCursor(new Date(year, month + 1, 1))}
          className="rounded-lg border border-border p-2"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEK.map((w, i) => (
          <div
            key={w}
            className={`py-1 ${i === 0 ? "text-destructive" : i === 6 ? "text-primary" : ""}`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((d, idx) => {
          if (!d) return <div key={idx} className="aspect-square" />;
          const s = fmt(d);
          const isToday = s === todayStr;
          const isSel = s === selected;
          const dow = d.getDay();
          const log = logCounts[s];
          const comp = comps.find((c) => c.date === s);
          return (
            <button
              key={s}
              onClick={() => setSelected(s)}
              className={`relative flex aspect-square flex-col items-center justify-start rounded-lg border p-1 text-sm transition-all ${
                isSel
                  ? "border-primary bg-primary/10"
                  : isToday
                    ? "border-primary/60 bg-card"
                    : "border-border/50 bg-card"
              }`}
            >
              <span
                className={`num ${
                  dow === 0 ? "text-destructive" : dow === 6 ? "text-primary" : ""
                } ${isToday ? "font-bold" : ""}`}
              >
                {d.getDate()}
              </span>
              <div className="mt-auto flex gap-0.5">
                {log ? <span className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                {comp ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "#FF4444" }}
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <Legend color="bg-primary" label="운동 완료" />
        <Legend color="" style={{ background: "#FF4444" }} label="시합" />
      </div>

      {/* Selected day detail */}
      <div className="mt-5 rounded-2xl border border-border bg-card p-4">
        <div className="text-sm font-semibold">
          {new Date(selected).toLocaleDateString("ko-KR", {
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </div>
        <div className="mt-3 space-y-2 text-sm">
          {selectedComps.map((c, i) => (
            <div
              key={i}
              className="rounded-lg p-2"
              style={{ background: "rgba(255,68,68,0.15)", color: "#FF4444" }}
            >
              🏆 시합: {c.name}
            </div>
          ))}
          {selectedCheckin && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">종목 강도</span>
                <span>
                  {EMOJI_SCALE[selectedCheckin.sport - 1]}{" "}
                  <span className="font-semibold">{SPORT_LABELS[selectedCheckin.sport - 1]}</span>
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">내가 느끼는 피로도</span>
                <span>
                  {EMOJI_SCALE[selectedCheckin.fatigue - 1]}{" "}
                  <span className="font-semibold">
                    {FATIGUE_LABELS[selectedCheckin.fatigue - 1]}
                  </span>
                </span>
              </div>
            </div>
          )}

          {selectedLogs.length > 0 ? (
            <div className="rounded-lg border border-border">
              <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
                루틴 ({selectedLogs.filter((l) => l.completed).length}/{selectedLogs.length} 완료)
              </div>
              <ul className="divide-y divide-border">
                {selectedLogs.map((l) => (
                  <li key={l.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{l.exercise_name}</span>
                      <span className={l.completed ? "text-primary" : "text-muted-foreground"}>
                        {l.completed ? "✓ 완료" : "미완료"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {l.actual_sets ?? l.planned_sets}세트 ×{" "}
                      {l.actual_reps ?? l.planned_reps}회
                      {(l.actual_weight ?? l.planned_weight) > 0
                        ? ` × ${l.actual_weight ?? l.planned_weight}kg`
                        : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!selectedComps.length && !selectedLogs.length && !selectedCheckin && (
            <div className="text-muted-foreground">기록이 없습니다.</div>
          )}
        </div>
      </div>

      {/* Trend graph */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <h2 className="font-bold">최근 30일 컨디션 트렌드</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="평균 종목강도" value={avgSport} />
          <Stat label="평균 내가 느끼는 피로도" value={avgFatigue} />
          <Stat
            label="피로 4+ 일수"
            value={`${highFatigueDays}일`}
            highlight={highFatigueDays >= 5}
          />
        </div>

        <div
          className="mt-3 rounded-2xl border border-border bg-card p-3"
          style={{ height: 220 }}
        >
          {trend.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              체크인 데이터가 없어요
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "#888" }} />
                <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #333" }} />
                <Line
                  type="monotone"
                  dataKey="sport"
                  name="종목강도"
                  stroke="#BFFF00"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="fatigue"
                  name="내가 느끼는 피로도"
                  stroke="#FF8800"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "#BFFF00" }} />
            종목강도
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: "#FF8800" }} />
            내가 느끼는 피로도
          </div>
          <span className="ml-auto">(1=가뿐 · 5=매우 힘듦)</span>
        </div>

        {highFatigueDays >= 5 && (
          <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            ⚠ 최근 30일 중 {highFatigueDays}일이 고피로 상태입니다. 회복을 늘려보세요.
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div
        className={`num mt-1 text-xl ${highlight ? "text-destructive" : "text-primary"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  style,
}: {
  color: string;
  label: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} style={style} />
      {label}
    </div>
  );
}
