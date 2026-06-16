import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  LIFT_TYPES,
  LIFT_LABELS,
  LIFT_COLORS,
  E1RM_TREND_LIFTS,
  type LiftType,
} from "@/lib/types";
import { calculateE1RM } from "@/lib/calc";
import { addDaysStr } from "@/lib/carryover";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { Trash2, Check, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// Accept only YYYY-MM-DD that parses to a real calendar date within
// a sensible range (2000-01-01 ~ 오늘 자정+30일). 잘못된 값은 ""로 떨어뜨려
// 컴포넌트가 오늘 날짜로 정규화하도록 한다.
const isValidDateStr = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString().slice(0, 10) !== s) return false; // 2024-02-31 같은 가짜
  const min = new Date("2000-01-01T00:00:00").getTime();
  const today = new Date().toISOString().slice(0, 10);
  const maxD = new Date(today + "T00:00:00");
  maxD.setDate(maxD.getDate() + 30);
  const max = maxD.getTime();
  const t = d.getTime();
  return t >= min && t <= max;
};

const recordsSearchSchema = z.object({
  date: fallback(z.string().refine(isValidDateStr), "").default(""),
});

export const Route = createFileRoute("/_app/records")({
  validateSearch: zodValidator(recordsSearchSchema),
  component: RecordsPage,
});

interface Lift {
  id: string;
  lift_type: string;
  e1rm: number;
  weight_lifted: number;
  reps: number;
  recorded_date: string;
}

const BIG4: readonly LiftType[] = E1RM_TREND_LIFTS;

function RecordsPage() {
  const { user } = useAuth();
  const [lifts, setLifts] = useState<Record<string, Lift>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [bodyweight, setBodyweight] = useState(0);
  const [editFor, setEditFor] = useState<LiftType | null>(null);

  async function reload() {
    if (!user) return;
    const [liftRes, profileRes] = await Promise.all([
      supabase.from("athlete_lifts").select("*").eq("athlete_id", user.id).eq("is_current", true),
      supabase.from("profiles").select("bodyweight").eq("id", user.id).maybeSingle(),
    ]);
    const m: Record<string, Lift> = {};
    (liftRes.data ?? []).forEach((l: any) => (m[l.lift_type] = l));
    setLifts(m);
    setBodyweight(Number(profileRes.data?.bodyweight) || 0);
  }
  useEffect(() => {
    reload();
  }, [user]);

  async function deleteLift(lift: LiftType) {
    if (!user) return;
    if (!confirm(`${LIFT_LABELS[lift]} 기록을 모두 삭제할까요?`)) return;
    const { error } = await supabase
      .from("athlete_lifts")
      .delete()
      .eq("athlete_id", user.id)
      .eq("lift_type", lift);
    if (error) return toast.error(error.message);
    setHidden((s) => new Set(s).add(lift));
    toast.success("삭제됨");
    reload();
  }

  const visibleLifts = LIFT_TYPES.filter((l) => !hidden.has(l));

  return (
    <>
      <TopBar title="내 기록" />
      <div className="container-mobile pb-24 pt-3 space-y-4">
        <DayLogViewer />
        <section className="space-y-3">
          <h2 className="text-lg font-bold">현재 e1RM</h2>
          {visibleLifts.map((lift) => {
            const l = lifts[lift];
            const isBig4 = (BIG4 as readonly string[]).includes(lift);
            return (
              <div key={lift} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold">{LIFT_LABELS[lift]}</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span
                        className="num text-3xl"
                        style={isBig4 ? { color: LIFT_COLORS[lift] } : { color: "#FFFFFF" }}
                      >
                        {l?.e1rm ?? "—"}
                      </span>
                      <span className="text-sm text-muted-foreground">kg</span>
                    </div>
                    {l && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {l.weight_lifted}kg × {l.reps}회 · {l.recorded_date}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditFor(lift)}
                      className="rounded-lg border border-border px-4 py-2 text-sm"
                    >
                      업데이트
                    </button>
                    <button
                      onClick={() => deleteLift(lift)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/40 text-destructive"
                      title="이 종목 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section>
          <h2 className="mb-2 text-lg font-bold">추이 그래프 <span className="text-xs font-normal text-muted-foreground">(4대 운동)</span></h2>
          <TrendChart />
        </section>

        {editFor && (
          <UpdateModal
            lift={editFor}
            bodyweight={bodyweight}
            currentE1RM={lifts[editFor]?.e1rm ?? 0}
            onClose={() => setEditFor(null)}
            onSaved={() => {
              setEditFor(null);
              reload();
            }}
          />
        )}
      </div>
    </>
  );
}

function TrendChart() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<1 | 3 | 6 | 0>(3);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      let q = supabase
        .from("athlete_lifts")
        .select("lift_type,e1rm,recorded_date")
        .eq("athlete_id", user.id)
        .in("lift_type", BIG4 as any);
      if (period > 0) {
        const since = new Date();
        since.setMonth(since.getMonth() - period);
        q = q.gte("recorded_date", since.toISOString().slice(0, 10));
      }
      const { data: rows } = await q.order("recorded_date", { ascending: true });
      const byDate: Record<string, any> = {};
      (rows ?? []).forEach((l) => {
        (byDate[l.recorded_date] ??= { date: l.recorded_date })[l.lift_type] = Number(l.e1rm);
      });
      setData(Object.values(byDate));
    })();
  }, [user, period]);

  return (
    <div>
      <div className="mb-2 flex gap-1 text-xs">
        {[1, 3, 6, 0].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p as any)}
            className={`rounded-full px-3 py-1 ${
              period === p ? "bg-primary/20 text-primary" : "text-muted-foreground"
            }`}
          >
            {p === 0 ? "전체" : `${p}개월`}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-3" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
            <YAxis tick={{ fontSize: 10, fill: "#888" }} />
            <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #333" }} />
            {BIG4.map((l) => (
              <Line key={l} type="monotone" dataKey={l} stroke={LIFT_COLORS[l]} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {BIG4.map((l) => (
          <span key={l} className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[11px]">
            <span className="h-2 w-2 rounded-full" style={{ background: LIFT_COLORS[l] }} />
            {LIFT_LABELS[l]}
          </span>
        ))}
      </div>
    </div>
  );
}

function UpdateModal({
  lift,
  bodyweight,
  currentE1RM,
  onClose,
  onSaved,
}: {
  lift: LiftType;
  bodyweight: number;
  currentE1RM: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [w, setW] = useState("");
  const [r, setR] = useState("");
  const [saving, setSaving] = useState(false);

  const newE1 = w && r ? calculateE1RM(parseFloat(w), parseInt(r), lift, bodyweight) : null;
  const diff = newE1 !== null ? Math.round((newE1 - currentE1RM) * 10) / 10 : null;

  async function save() {
    if (!user || !w || !r) return;
    const wN = parseFloat(w);
    const rN = parseInt(r);
    if (wN < 0 || rN < 1 || rN > 20) {
      toast.error("입력값을 확인해주세요");
      return;
    }
    setSaving(true);
    await supabase
      .from("athlete_lifts")
      .update({ is_current: false })
      .eq("athlete_id", user.id)
      .eq("lift_type", lift)
      .eq("is_current", true);
    const { error } = await supabase.from("athlete_lifts").insert({
      athlete_id: user.id,
      lift_type: lift,
      weight_lifted: wN,
      reps: rN,
      e1rm: calculateE1RM(wN, rN, lift, bodyweight),
      is_current: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("업데이트 완료");
    onSaved();
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">{LIFT_LABELS[lift]} 업데이트</h3>
        <div className="mt-4 flex gap-2">
          <input type="number" step="0.5" placeholder="무게(kg)" value={w} onChange={(e) => setW(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary" />
          <input type="number" min="1" max="20" placeholder="반복" value={r} onChange={(e) => setR(e.target.value)} className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary" />
        </div>
        {newE1 !== null && (
          <div className="mt-4 rounded-lg bg-secondary p-3 text-center">
            <div className="text-xs text-muted-foreground">새 e1RM</div>
            <div className="num text-2xl text-primary">
              {newE1}kg{" "}
              {diff !== null && diff !== 0 && (
                <span className={`text-sm ${diff > 0 ? "text-success" : "text-destructive"}`}>
                  ({diff > 0 ? "+" : ""}{diff})
                </span>
              )}
            </div>
          </div>
        )}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3">취소</button>
          <button disabled={saving || !newE1} onClick={save} className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40">
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DayLog {
  id: string;
  exercise_name: string;
  planned_sets: number | null;
  planned_reps: number | null;
  planned_weight: number | null;
  actual_sets: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  completed: boolean;
  skipped: boolean;
  rpe: number | null;
  note: string | null;
  set_logs: any;
}

function DayLogViewer() {
  const { user } = useAuth();
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const { date: dateParam } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const dateStr = dateParam || todayStr;
  const setDateStr = (next: string) => {
    if (next === dateStr) return;
    navigate({
      search: (prev: { date: string }) => ({ ...prev, date: next === todayStr ? "" : next }),
    });
  };
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateInput, setDateInput] = useState(dateStr);
  const [checkin, setCheckin] = useState<{ sport_intensity: number; fatigue_level: number; note: string | null } | null>(null);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [competitionDates, setCompetitionDates] = useState<Set<string>>(new Set());
  const [nbByDate, setNbByDate] = useState<Map<string, number>>(new Map());
  const [nbRange, setNbRange] = useState<7 | 30 | 0>(7);
  const [nbSeries, setNbSeries] = useState<{ date: string; total: number }[]>([]);
  const [calMonth, setCalMonth] = useState<Date>(new Date(dateStr + "T00:00:00"));

  useEffect(() => {
    setDateInput(dateStr);
  }, [dateStr]);

  const submitDateInput = () => {
    const v = dateInput.trim();
    if (v === dateStr) return;
    if (!isValidDateStr(v)) {
      toast.error("YYYY-MM-DD 형식의 올바른 날짜를 입력하세요. 오늘로 이동했어요.");
      setDateInput(todayStr);
      setDateStr(todayStr);
      return;
    }
    setDateStr(v);
  };

  // 잘못된 ?date= 값으로 들어온 경우(검증 실패 → "")엔 URL 도 정리하고 안내.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("date");
    if (raw && !isValidDateStr(raw)) {
      toast.error("잘못된 날짜입니다. 오늘로 이동했어요.");
      navigate({
        search: (prev: { date: string }) => ({ ...prev, date: "" }),
        replace: true,
      });
    }
    // 최초 마운트 시점에만 검사
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMonthMarkers(monthDate: Date) {
    if (!user) return;
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = new Date(y, m + 1, 0);
    const endStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    const [w, c, nb] = await Promise.all([
      supabase
        .from("workout_logs")
        .select("date")
        .eq("athlete_id", user.id)
        .gte("date", start)
        .lte("date", endStr),
      supabase
        .from("competitions")
        .select("competition_date")
        .eq("athlete_id", user.id)
        .gte("competition_date", start)
        .lte("competition_date", endStr),
      supabase
        .from("neural_budget_daily")
        .select("date,total_score")
        .eq("athlete_id", user.id)
        .gte("date", start)
        .lte("date", endStr),
    ]);
    setWorkoutDates(new Set((w.data ?? []).map((r: any) => r.date)));
    setCompetitionDates(new Set((c.data ?? []).map((r: any) => r.competition_date)));
    const map = new Map<string, number>();
    for (const r of (nb.data ?? []) as any[]) map.set(r.date, Number(r.total_score || 0));
    setNbByDate(map);
  }

  useEffect(() => {
    loadMonthMarkers(calMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, calMonth]);

  // Load Neural Budget series
  useEffect(() => {
    if (!user) return;
    (async () => {
      let q = supabase.from("neural_budget_daily")
        .select("date, total_score").eq("athlete_id", user.id)
        .order("date", { ascending: true });
      if (nbRange > 0) {
        const since = new Date();
        since.setDate(since.getDate() - nbRange + 1);
        q = q.gte("date", since.toISOString().slice(0, 10));
      }
      const { data } = await q;
      setNbSeries((data ?? []).map((r: any) => ({ date: r.date, total: Number(r.total_score || 0) })));
    })();
  }, [user, nbRange, dateStr]);


  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const [logRes, ckRes] = await Promise.all([
        supabase
          .from("workout_logs")
          .select("*")
          .eq("athlete_id", user.id)
          .eq("date", dateStr)
          .order("created_at", { ascending: true }),
        supabase
          .from("daily_checkins")
          .select("sport_intensity,fatigue_level,note")
          .eq("athlete_id", user.id)
          .eq("date", dateStr)
          .maybeSingle(),
      ]);
      setLogs((logRes.data ?? []) as DayLog[]);
      setCheckin((ckRes.data as any) ?? null);
      setLoading(false);
    })();
  }, [user, dateStr]);

  async function toggleCompetition() {
    if (!user) return;
    const isComp = competitionDates.has(dateStr);
    if (isComp) {
      const { error } = await supabase
        .from("competitions")
        .delete()
        .eq("athlete_id", user.id)
        .eq("competition_date", dateStr);
      if (error) return toast.error(error.message);
      toast.success("시합일 해제");
    } else {
      const { error } = await supabase
        .from("competitions")
        .insert({
          athlete_id: user.id,
          competition_date: dateStr,
          competition_name: "시합일",
          importance: "B",
        } as any);
      if (error) return toast.error(error.message);
      toast.success("시합일로 저장");
    }
    loadMonthMarkers(calMonth);
  }

  const d = new Date(dateStr + "T00:00:00");
  const isToday = dateStr === todayStr;
  const completedCount = logs.filter((l) => l.completed).length;

  const maxDate = useMemo(() => {
    const d = new Date(todayStr + "T00:00:00");
    d.setDate(d.getDate() + 30);
    return d;
  }, [todayStr]);
  const maxDateStr = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setDateStr(todayStr)}
          className={`flex-1 rounded-xl border px-3 py-2 text-center ${
            isToday ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
          }`}
        >
          <div className="text-sm font-semibold">
            {d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {isToday ? "오늘" : "오늘로 이동"}
          </div>
        </button>
      </div>


      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          value={dateInput}
          maxLength={10}
          onChange={(e) => setDateInput(e.target.value)}
          onBlur={submitDateInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm font-mono tracking-wider"
          aria-label="날짜 직접 입력 (YYYY-MM-DD)"
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm"
              aria-label="달력에서 날짜 선택"
            >
              <CalendarIcon size={16} />
              <span className="hidden sm:inline">달력</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={d}
              month={calMonth}
              onMonthChange={setCalMonth}
              onSelect={(picked) => {
                if (!picked) return;
                const y = picked.getFullYear();
                const m = String(picked.getMonth() + 1).padStart(2, "0");
                const day = String(picked.getDate()).padStart(2, "0");
                setDateStr(`${y}-${m}-${day}`);
              }}
              onDayClick={(_day, modifiers) => {
                if (modifiers.disabled) {
                  toast.error(`2000-01-01 ~ ${maxDateStr} 범위의 날짜만 선택할 수 있어요.`);
                }
              }}
              fromDate={new Date("2000-01-01")}
              toDate={maxDate}
              disabled={(date) =>
                date > maxDate || date < new Date("2000-01-01")
              }
              modifiers={{
                workout: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  return workoutDates.has(s);
                },
                competition: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  return competitionDates.has(s);
                },
                nbGreen: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const v = nbByDate.get(s); return v !== undefined && v <= 30;
                },
                nbBlue: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const v = nbByDate.get(s); return v !== undefined && v > 30 && v <= 50;
                },
                nbOrange: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const v = nbByDate.get(s); return v !== undefined && v > 50 && v <= 70;
                },
                nbRed: (date) => {
                  const s = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                  const v = nbByDate.get(s); return v !== undefined && v > 70;
                },
              }}
              modifiersClassNames={{
                workout: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
                competition: "!bg-destructive/20 !text-destructive font-bold",
                nbGreen: "ring-2 ring-inset ring-emerald-500/60 rounded-md",
                nbBlue: "ring-2 ring-inset ring-blue-500/60 rounded-md",
                nbOrange: "ring-2 ring-inset ring-orange-500/60 rounded-md",
                nbRed: "ring-2 ring-inset ring-red-500/70 rounded-md",
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground space-y-0.5">
              <div>선택 가능: 2000-01-01 ~ {maxDateStr}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 운동
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded bg-destructive/40" /> 시합일
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded ring-2 ring-emerald-500/60" /> NB 회복
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded ring-2 ring-blue-500/60" /> 적정
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded ring-2 ring-orange-500/60" /> 높음
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded ring-2 ring-red-500/70" /> 매우높음
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <button
          onClick={submitDateInput}
          className="rounded-xl border border-border px-3 py-2 text-sm"
        >
          이동
        </button>
      </div>


      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3">
        <div className="text-xs">
          {competitionDates.has(dateStr) ? (
            <span className="font-bold text-destructive">🏆 시합일로 표시된 날짜</span>
          ) : (
            <span className="text-muted-foreground">이 날을 시합일로 표시할 수 있어요</span>
          )}
        </div>
        <button
          onClick={toggleCompetition}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
            competitionDates.has(dateStr)
              ? "border border-destructive/40 text-destructive"
              : "border border-primary/40 text-primary"
          }`}
        >
          {competitionDates.has(dateStr) ? "시합일 해제" : "시합일로 설정"}
        </button>
      </div>

      {checkin && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-1 text-xs font-bold">이날 컨디션</div>
          <div className="text-xs text-muted-foreground">
            종목강도 {checkin.sport_intensity}/5 · 피로도 {checkin.fatigue_level}/5
          </div>
          {checkin.note && (
            <div className="mt-1 text-[11px] text-muted-foreground">메모: {checkin.note}</div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">몸 회복 트렌드</h3>
          <div className="flex gap-1">
            {([7, 30, 0] as const).map((r) => (
              <button
                key={r}
                onClick={() => setNbRange(r)}
                className={`rounded-md px-2 py-0.5 text-[11px] ${nbRange === r ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
              >
                {r === 0 ? "전체" : `${r}일`}
              </button>
            ))}
          </div>
        </div>
        {nbSeries.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">아직 기록된 회복 예산 데이터가 없습니다.</div>
        ) : (
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={nbSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>


      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold">날짜별 운동 기록</h3>
          <span className="text-xs text-muted-foreground">
            {logs.length > 0 ? `${completedCount}/${logs.length} 완료` : "기록 없음"}
          </span>
        </div>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">불러오는 중…</div>
        ) : logs.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            이 날짜에는 운동 기록이 없습니다.
          </div>
        ) : (
          <ul className="space-y-2">
            {logs.map((l) => {
              const sets = Array.isArray(l.set_logs) ? l.set_logs : [];
              const plannedTxt =
                l.planned_sets && l.planned_reps
                  ? `${l.planned_sets}×${l.planned_reps}${l.planned_weight ? ` @ ${l.planned_weight}kg` : ""}`
                  : null;
              return (
                <li
                  key={l.id}
                  className={`rounded-xl border p-3 ${
                    l.completed
                      ? "border-success/40 bg-success/5"
                      : l.skipped
                        ? "border-border opacity-60"
                        : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {l.completed && <Check size={14} className="text-success shrink-0" />}
                        <span className="truncate font-semibold text-sm">{l.exercise_name}</span>
                      </div>
                      {plannedTxt && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          계획: {plannedTxt}
                        </div>
                      )}
                    </div>
                    {l.rpe != null && (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px]">
                        RPE {l.rpe}
                      </span>
                    )}
                  </div>
                  {sets.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {sets.map((s: any, i: number) => (
                        <span
                          key={i}
                          className={`rounded px-2 py-0.5 text-[10px] ${
                            s.completed
                              ? "bg-success/15 text-success"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {i + 1}세트 {s.weight ?? "-"}kg × {s.reps ?? "-"}
                        </span>
                      ))}
                    </div>
                  )}
                  {l.note && (
                    <div className="mt-2 text-[11px] text-muted-foreground">메모: {l.note}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
