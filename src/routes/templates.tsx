import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LIFT_LABELS, type LiftType } from "@/lib/types";
import { toast } from "sonner";
import {
  buildWeekdayMap,
  buildSnapshot,
  type RoutinePrefs,
  type TemplateLite,
  type TemplateDayLite,
  type TemplateExerciseLite,
} from "@/lib/routine-engine";
import { TrialBanner } from "@/components/TrialBanner";
import { RoutineGeneratingOverlay } from "@/components/RoutineGeneratingOverlay";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageLoading } from "@/components/PageLoading";

export const Route = createFileRoute("/templates")({
  component: RoutineBuilderPage,
});

// ─── Quick start cards (hardcoded MVP) ─────────────────────────────
type QuickRoutineKey = "full_body_3" | "full_body_4" | "full_body_5" | "upper_lower_4" | "dup_4";

interface QuickCard {
  key: QuickRoutineKey;
  name: string;
  daysPerWeek: number;
  description: string;
  // template_name patterns to look up routine_templates row
  splitType: string;
  goalType: string;
}

const QUICK_CARDS: QuickCard[] = [
  { key: "full_body_3",   name: "무분할 주3",     daysPerWeek: 3, description: "주 3일 전신훈련. 종목훈련 비중이 높거나 회복이 우선인 선수에게 적합합니다.",       splitType: "full_body_3",   goalType: "general" },
  { key: "full_body_4",   name: "무분할 주4",     daysPerWeek: 4, description: "주 4일 전신훈련. 빈도와 회복을 균형 있게 가져가고 싶은 선수에게 적합합니다.",     splitType: "full_body_4",   goalType: "general" },
  { key: "full_body_5",   name: "무분할 주5",     daysPerWeek: 5, description: "주 5일 짧고 자주. 종목훈련과 병행해 빈도 자극을 노리는 선수에게 적합합니다.",     splitType: "five_split_5",  goalType: "general" },
  { key: "upper_lower_4", name: "상하체 분할 주4", daysPerWeek: 4, description: "상체/하체 분할 4일. 기본 근력과 볼륨을 함께 챙기고 싶은 선수에게 적합합니다.",   splitType: "upper_lower_4", goalType: "strength" },
  { key: "dup_4",         name: "DUP 주4",        daysPerWeek: 4, description: "주중 강도/반복을 교차 변화시키는 DUP 방식. 자극의 다양성을 원하는 선수에게 적합합니다.", splitType: "full_body_4",   goalType: "dup" },
];

// ─── Custom builder constants ──────────────────────────────────────
const GOALS = [
  { v: "general", label: "전반적 근력" },
  { v: "strength", label: "최대근력" },
  { v: "hypertrophy", label: "근비대" },
  { v: "power", label: "파워" },
  { v: "sport", label: "종목경기력" },
] as const;

const SEASONS = [
  { v: "offseason", label: "비시즌기", hint: "웨이트 볼륨 증가에 좋음" },
  { v: "preseason", label: "프리시즌", hint: "근력→파워로 전환" },
  { v: "inseason",  label: "시즌기",   hint: "회복 여유 유지" },
] as const;

const LOADS = [
  { v: "low", label: "낮음" },
  { v: "medium", label: "보통" },
  { v: "high", label: "높음" },
  { v: "very_high", label: "매우 높음" },
] as const;

const DAY_OPTS = [3, 4, 5, 6];

const WEEKDAYS = [
  { v: 1, label: "월" }, { v: 2, label: "화" }, { v: 3, label: "수" },
  { v: 4, label: "목" }, { v: 5, label: "금" }, { v: 6, label: "토" }, { v: 0, label: "일" },
];

const PRIORITY_OPTIONS: LiftType[] = [
  "squat", "bench", "deadlift", "ohp", "power_clean", "pullup", "dips",
];

// ─── Component ─────────────────────────────────────────────────────
type Mode = "menu" | "custom";

interface CustomAnswers extends RoutinePrefs {
  goal_type: string;
  start_date: string;
  competition_date: string | null;
  main_goal: "hypertrophy" | "strength";
  main_rep_low: number;
  main_rep_high: number;
  // MVP A additions
  sport_training_stress_level: "낮음" | "보통" | "높음" | "매우높음";
  strength_training_tolerance: "낮음" | "보통" | "높음";
  current_goal: "근비대" | "스트렝스" | "파워" | "유지" | "보강";
  competition_weeks_out: number | null;
  weekly_program_mode: "auto" | "weekly_manual";
  priority_focus_1: string | null;
  priority_focus_2: string | null;
  priority_focus_3: string | null;
  main_prescription_preference: "fixed_sets" | "top_backoff" | "mixed";
  target_rep_zone: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_CUSTOM: CustomAnswers = {
  goal_type: "general",
  season_phase: "offseason",
  sport_training_load: "medium",
  desired_lifting_days: 4,
  preferred_lifting_weekdays: [1, 3, 5, 6],
  priority_lifts: [],
  start_date: todayStr(),
  competition_date: null,
  main_goal: "hypertrophy",
  main_rep_low: 8,
  main_rep_high: 10,
  sport_training_stress_level: "보통",
  strength_training_tolerance: "보통",
  current_goal: "근비대",
  competition_weeks_out: null,
  weekly_program_mode: "auto",
  priority_focus_1: null,
  priority_focus_2: null,
  priority_focus_3: null,
  main_prescription_preference: "fixed_sets",
  target_rep_zone: "8-10",
};

function RoutineBuilderPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>("menu");
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [starting, setStarting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastAssign, setLastAssign] = useState<(() => void) | null>(null);
  const [custom, setCustom] = useState<CustomAnswers>(DEFAULT_CUSTOM);

  useEffect(() => {
    supabase
      .from("routine_templates")
      .select("*")
      .eq("is_public", true)
      .order("days_per_week")
      .then(({ data }) => setTemplates((data as TemplateLite[]) ?? []));
  }, []);

  if (loading) return <PageLoading title="루틴 만들기" message="루틴 불러오는 중" />;
  if (!user) return <Navigate to="/login" replace />;

  function resolveTemplate(splitType: string): TemplateLite | null {
    return templates.find((t) => t.split_type === splitType) ?? null;
  }

  async function runAssign(opts: {
    source: "quick_start" | "personalized";
    routineType: string;
    splitType: string;
    goalType: string;
    prefs: RoutinePrefs;
    startDate: string;
    competitionDate: string | null;
    mainGoal?: "hypertrophy" | "strength";
    mainRepLow?: number;
    mainRepHigh?: number;
    extras?: Partial<{
      sport_training_stress_level: string;
      strength_training_tolerance: string;
      current_goal: string;
      competition_weeks_out: number | null;
      weekly_program_mode: string;
      priority_focus_1: string | null;
      priority_focus_2: string | null;
      priority_focus_3: string | null;
      main_prescription_preference: string;
      target_rep_zone: string;
    }>;
  }) {
    if (!user || starting) return;
    setStarting(true);
    setGenError(null);
    const startedAt = Date.now();
    const minDelay = new Promise((r) => setTimeout(r, 2500));

    const exec = async () => {
      const t = resolveTemplate(opts.splitType);
      if (!t) throw new Error(`'${opts.routineType}' 루틴을 찾을 수 없습니다`);

      const { data: days } = await supabase
        .from("template_days")
        .select("id, day_of_week, week_number, is_rest_day, day_title")
        .eq("template_id", t.id)
        .order("week_number").order("day_of_week");
      const daysList = (days ?? []) as TemplateDayLite[];
      const dayIds = daysList.map((d) => d.id);
      const { data: exs } = dayIds.length
        ? await supabase.from("template_exercises").select("*").in("template_day_id", dayIds).order("order_index")
        : { data: [] as any[] };
      const exsList = (exs ?? []) as TemplateExerciseLite[];

      const week1 = daysList.filter((d) => d.week_number === 1 && !d.is_rest_day);
      const weekdayMap = buildWeekdayMap(
        opts.prefs.preferred_lifting_weekdays,
        week1.map((d) => d.day_of_week),
      );
      const snapshot = buildSnapshot(daysList, exsList, opts.prefs);

      await supabase.from("athlete_preferences").upsert(
        {
          athlete_id: user.id,
          season_phase: opts.prefs.season_phase,
          sport_training_load: opts.prefs.sport_training_load,
          desired_lifting_days: opts.prefs.desired_lifting_days,
          preferred_lifting_weekdays: opts.prefs.preferred_lifting_weekdays,
          priority_lifts: opts.prefs.priority_lifts,
          selected_routine_type: opts.routineType,
          selected_template_id: t.id,
          routine_assignment_source: opts.source,
        } as any,
        { onConflict: "athlete_id" },
      );

      await supabase.from("athlete_routine_assignments")
        .update({ is_active: false }).eq("athlete_id", user.id).eq("is_active", true);
      await supabase.from("athlete_active_template")
        .update({ is_active: false }).eq("athlete_id", user.id).eq("is_active", true);

      const { data: ass, error: aErr } = await supabase
        .from("athlete_routine_assignments")
        .insert({
          athlete_id: user.id,
          source_template_id: t.id,
          assignment_source: opts.source,
          split_type: t.split_type,
          routine_type: opts.routineType,
          goal_type: opts.goalType,
          season_phase: opts.prefs.season_phase,
          sport_training_load: opts.prefs.sport_training_load,
          desired_lifting_days: opts.prefs.desired_lifting_days,
          preferred_weekdays: opts.prefs.preferred_lifting_weekdays,
          competition_date: opts.competitionDate,
          days_per_week: t.days_per_week,
          duration_weeks: t.duration_weeks,
          weekday_map: weekdayMap as any,
          snapshot: snapshot as any,
          priority_lifts: opts.prefs.priority_lifts,
          is_active: true,
          start_date: opts.startDate,
          current_week: 1,
          main_goal: opts.mainGoal ?? "hypertrophy",
          main_rep_low: opts.mainRepLow ?? 8,
          main_rep_high: opts.mainRepHigh ?? 10,
          ...(opts.extras ?? {}),
        } as any)
        .select("id").single();
      if (aErr) throw aErr;

      const { error: actErr } = await supabase.from("athlete_active_template").insert({
        athlete_id: user.id,
        template_id: t.id,
        start_date: opts.startDate,
        current_week: 1,
        is_active: true,
      });
      if (actErr) throw actErr;

      if (ass?.id) {
        await supabase.from("athlete_preferences")
          .update({ athlete_assigned_routine_id: ass.id } as any)
          .eq("athlete_id", user.id);
      }
    };

    try {
      await Promise.all([exec(), minDelay]);
      toast.success("루틴이 배정되었습니다");
      nav({ to: "/today", replace: true });
    } catch (e: any) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 800) await new Promise((r) => setTimeout(r, 800 - elapsed));
      setGenError(e?.message ?? "알 수 없는 오류");
      setStarting(false);
    }
  }

  function quickStart(card: QuickCard) {
    const prefs: RoutinePrefs = {
      season_phase: "offseason",
      sport_training_load: "medium",
      desired_lifting_days: card.daysPerWeek,
      preferred_lifting_weekdays: [1, 3, 5, 6].slice(0, card.daysPerWeek),
      priority_lifts: [],
    };
    const fn = () => runAssign({
      source: "quick_start",
      routineType: card.name,
      splitType: card.splitType,
      goalType: card.goalType,
      prefs,
      startDate: todayStr(),
      competitionDate: null,
    });
    setLastAssign(() => fn);
    fn();
  }

  function customStart() {
    if (custom.preferred_lifting_weekdays.length !== custom.desired_lifting_days) {
      toast.error(`주 ${custom.desired_lifting_days}일에 맞춰 요일 ${custom.desired_lifting_days}개를 선택해 주세요`);
      return;
    }
    // Pick split_type by days
    const split = custom.desired_lifting_days === 3 ? "full_body_3"
      : custom.desired_lifting_days === 4 ? "full_body_4"
      : "five_split_5";
    const routineType = `직접 만들기 (주 ${custom.desired_lifting_days}일)`;
    const fn = () => runAssign({
      source: "personalized",
      routineType,
      splitType: split,
      goalType: custom.goal_type,
      prefs: {
        season_phase: custom.season_phase,
        sport_training_load: custom.sport_training_load,
        desired_lifting_days: custom.desired_lifting_days,
        preferred_lifting_weekdays: custom.preferred_lifting_weekdays,
        priority_lifts: custom.priority_lifts,
      },
      startDate: custom.start_date,
      competitionDate: custom.competition_date,
      mainGoal: custom.main_goal,
      mainRepLow: custom.main_rep_low,
      mainRepHigh: custom.main_rep_high,
      extras: {
        sport_training_stress_level: custom.sport_training_stress_level,
        strength_training_tolerance: custom.strength_training_tolerance,
        current_goal: custom.current_goal,
        competition_weeks_out: custom.competition_weeks_out,
        weekly_program_mode: custom.weekly_program_mode,
        priority_focus_1: custom.priority_focus_1,
        priority_focus_2: custom.priority_focus_2,
        priority_focus_3: custom.priority_focus_3,
        main_prescription_preference: custom.main_prescription_preference,
        target_rep_zone: custom.target_rep_zone,
      },
    });
    setLastAssign(() => fn);
    fn();
  }

  function retry() { lastAssign?.(); }
  function cancelGen() { setStarting(false); setGenError(null); }

  function toggleWeekday(d: number) {
    setCustom((a) => ({
      ...a,
      preferred_lifting_weekdays: a.preferred_lifting_weekdays.includes(d)
        ? a.preferred_lifting_weekdays.filter((x) => x !== d)
        : [...a.preferred_lifting_weekdays, d].sort(),
    }));
  }

  function togglePriority(l: LiftType) {
    setCustom((a) => {
      const cur = a.priority_lifts;
      if (cur.includes(l)) return { ...a, priority_lifts: cur.filter((x) => x !== l) };
      if (cur.length >= 3) { toast.error("최대 3개"); return a; }
      return { ...a, priority_lifts: [...cur, l] };
    });
  }

  return (
    <div className="container-mobile py-8 pb-28">
      <RoutineGeneratingOverlay open={starting || !!genError} error={genError} onRetry={retry} onCancel={cancelGen} />
      <TrialBanner />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="num text-3xl text-primary">루틴 만들기</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "menu" ? "원하는 방식으로 시작하세요" : "내가 직접 만들기"}
          </p>
        </div>
        {mode !== "menu" && (
          <button onClick={() => setMode("menu")} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
            처음으로
          </button>
        )}
      </div>

      {mode === "menu" && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">⚡ 빠르게 시작하기</h2>
            <div className="space-y-3">
              {QUICK_CARDS.map((c) => (
                <div key={c.key} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold">{c.name}</h3>
                    <span className="text-[11px] text-muted-foreground">주 {c.daysPerWeek}일</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>
                  <button
                    disabled={starting}
                    onClick={() => quickStart(c)}
                    className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-40"
                  >
                    이 루틴으로 시작하기
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">🧭 내가 직접 만들기</h2>
            <button
              onClick={() => setMode("custom")}
              className="block w-full rounded-2xl border-2 border-primary/50 bg-primary/5 p-5 text-left"
            >
              <div className="text-lg font-bold">맞춤형 루틴 만들기</div>
              <p className="mt-2 text-sm text-muted-foreground">
                목표·시즌·종목 훈련 강도·요일·시합일 등을 설정해 나에게 맞는 루틴을 만듭니다.
              </p>
              <div className="mt-3 text-xs text-primary">시작하기 →</div>
            </button>
          </section>
        </div>
      )}

      {mode === "custom" && (
        <CustomBuilder
          custom={custom}
          setCustom={setCustom}
          toggleWeekday={toggleWeekday}
          togglePriority={togglePriority}
          onSubmit={customStart}
          starting={starting}
        />
      )}
    </div>
  );
}

// ─── Custom builder ────────────────────────────────────────────────
function CustomBuilder(props: {
  custom: CustomAnswers;
  setCustom: React.Dispatch<React.SetStateAction<CustomAnswers>>;
  toggleWeekday: (d: number) => void;
  togglePriority: (l: LiftType) => void;
  onSubmit: () => void;
  starting: boolean;
}) {
  const { custom, setCustom, toggleWeekday, togglePriority, onSubmit, starting } = props;

  const HYP_RANGES = [{ low: 6, high: 8 }, { low: 8, high: 10 }, { low: 10, high: 12 }];
  const STR_RANGES = [{ low: 1, high: 3 }, { low: 3, high: 5 }, { low: 4, high: 6 }];
  const rangeOpts = custom.main_goal === "strength" ? STR_RANGES : HYP_RANGES;

  return (
    <div className="mt-6 space-y-6">
      <Group title="메인 운동 목표">
        <div className="grid grid-cols-2 gap-2">
          {([
            { v: "hypertrophy", label: "근비대" },
            { v: "strength", label: "스트렝스" },
          ] as const).map((g) => (
            <Chip
              key={g.v}
              active={custom.main_goal === g.v}
              onClick={() => {
                const fallback = g.v === "strength" ? { low: 3, high: 5 } : { low: 8, high: 10 };
                setCustom((a) => ({ ...a, main_goal: g.v, main_rep_low: fallback.low, main_rep_high: fallback.high }));
              }}
            >
              <div className="text-sm font-semibold">{g.label}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="메인 운동 반복 범위">
        <div className="grid grid-cols-3 gap-2">
          {rangeOpts.map((r) => {
            const active = custom.main_rep_low === r.low && custom.main_rep_high === r.high;
            return (
              <Chip key={`${r.low}-${r.high}`} active={active} onClick={() => setCustom((a) => ({ ...a, main_rep_low: r.low, main_rep_high: r.high }))}>
                <div className="text-center text-sm font-semibold">{r.low}~{r.high}회</div>
              </Chip>
            );
          })}
        </div>
      </Group>

      <Group title="전반 목표">
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((g) => (
            <Chip key={g.v} active={custom.goal_type === g.v} onClick={() => setCustom((a) => ({ ...a, goal_type: g.v }))}>
              <div className="text-sm font-semibold">{g.label}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="시즌 상태">
        <div className="grid grid-cols-3 gap-2">
          {SEASONS.map((s) => (
            <Chip key={s.v} active={custom.season_phase === (s.v as any)} onClick={() => setCustom((a) => ({ ...a, season_phase: s.v as any }))}>
              <div className="text-sm font-semibold">{s.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{s.hint}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="종목 훈련 강도">
        <div className="grid grid-cols-4 gap-2">
          {LOADS.map((l) => (
            <Chip key={l.v} active={custom.sport_training_load === l.v} onClick={() => setCustom((a) => ({ ...a, sport_training_load: l.v as any }))}>
              <div className="text-center text-sm font-semibold">{l.label}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="주당 웨이트 횟수">
        <div className="grid grid-cols-4 gap-2">
          {DAY_OPTS.map((d) => (
            <Chip key={d} active={custom.desired_lifting_days === d} onClick={() => setCustom((a) => ({ ...a, desired_lifting_days: d }))}>
              <div className="text-center font-semibold">주 {d}일</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="시작 날짜">
        <DatePickerField
          value={custom.start_date}
          onChange={(v) => setCustom((a) => ({ ...a, start_date: v ?? todayStr() }))}
          placeholder="시작 날짜 선택"
        />
      </Group>

      <Group title={`운동 요일 (${custom.preferred_lifting_weekdays.length}/${custom.desired_lifting_days})`}>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <button
              key={d.v}
              onClick={() => toggleWeekday(d.v)}
              className={`rounded-lg border-2 py-3 text-sm font-semibold ${
                custom.preferred_lifting_weekdays.includes(d.v)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >{d.label}</button>
          ))}
        </div>
      </Group>

      <Group title="시합 날짜 (선택)">
        <DatePickerField
          value={custom.competition_date}
          onChange={(v) => setCustom((a) => ({ ...a, competition_date: v }))}
          placeholder="시합일 선택 (없으면 비워두기)"
          clearable
        />
      </Group>

      <Group title="우선순위 운동 (최대 3개)">
        <div className="grid grid-cols-2 gap-2">
          {PRIORITY_OPTIONS.map((l) => {
            const on = custom.priority_lifts.includes(l);
            const idx = custom.priority_lifts.indexOf(l);
            return (
              <button
                key={l}
                onClick={() => togglePriority(l)}
                className={`flex items-center justify-between rounded-xl border-2 px-3 py-3 text-sm font-semibold ${
                  on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                }`}
              >
                <span>
                  {LIFT_LABELS[l]}
                  {(l === "pullup" || l === "dips") && (<span className="ml-1 text-[10px] text-muted-foreground">(추가중량)</span>)}
                </span>
                {on && <span className="text-[10px]">{idx + 1}순위</span>}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="현재 종목훈련 스트레스/강도">
        <div className="grid grid-cols-4 gap-2">
          {(["낮음","보통","높음","매우높음"] as const).map((v) => (
            <Chip key={v} active={custom.sport_training_stress_level === v} onClick={() => setCustom((a) => ({ ...a, sport_training_stress_level: v }))}>
              <div className="text-center text-sm font-semibold">{v}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="스트렝스 훈련 감당량">
        <div className="grid grid-cols-3 gap-2">
          {(["낮음","보통","높음"] as const).map((v) => (
            <Chip key={v} active={custom.strength_training_tolerance === v} onClick={() => setCustom((a) => ({ ...a, strength_training_tolerance: v }))}>
              <div className="text-center text-sm font-semibold">{v}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="현재 목표">
        <div className="grid grid-cols-3 gap-2">
          {(["근비대","스트렝스","파워","유지","보강"] as const).map((v) => (
            <Chip key={v} active={custom.current_goal === v} onClick={() => setCustom((a) => ({ ...a, current_goal: v }))}>
              <div className="text-center text-sm font-semibold">{v}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="시합까지 남은 기간">
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: null, label: "없음" },
            { v: 2, label: "2주" },
            { v: 4, label: "4주" },
            { v: 6, label: "6주" },
            { v: 8, label: "8주" },
            { v: 12, label: "12주+" },
          ].map((o) => (
            <Chip key={String(o.v)} active={custom.competition_weeks_out === o.v} onClick={() => setCustom((a) => ({ ...a, competition_weeks_out: o.v }))}>
              <div className="text-center text-sm font-semibold">{o.label}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="주차 처방 방식">
        <div className="grid grid-cols-2 gap-2">
          <Chip active={custom.weekly_program_mode === "auto"} onClick={() => setCustom((a) => ({ ...a, weekly_program_mode: "auto" }))}>
            <div className="text-sm font-semibold">자동 (주차별 자동 조정)</div>
          </Chip>
          <Chip active={custom.weekly_program_mode === "weekly_manual"} onClick={() => setCustom((a) => ({ ...a, weekly_program_mode: "weekly_manual" }))}>
            <div className="text-sm font-semibold">매주 직접 처방</div>
          </Chip>
        </div>
      </Group>

      <Group title="약점 부위 / 올리고 싶은 종목 (1~3순위)">
        <div className="space-y-2">
          {([1,2,3] as const).map((n) => {
            const key = `priority_focus_${n}` as const;
            const v = custom[key] as string | null;
            return (
              <div key={n} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-xs font-bold text-muted-foreground">{n}순위</span>
                <input
                  value={v ?? ""}
                  onChange={(e) => setCustom((a) => ({ ...a, [key]: e.target.value || null }))}
                  placeholder="예: 스쿼트, 가슴, 등 등"
                  className="flex-1 rounded-lg border border-border bg-secondary px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </div>
            );
          })}
        </div>
      </Group>

      <Group title="메인 처방 선호 방식">
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: "fixed_sets", label: "고정 세트" },
            { v: "top_backoff", label: "탑+백오프" },
            { v: "mixed", label: "혼합" },
          ] as const).map((o) => (
            <Chip key={o.v} active={custom.main_prescription_preference === o.v} onClick={() => setCustom((a) => ({ ...a, main_prescription_preference: o.v }))}>
              <div className="text-center text-sm font-semibold">{o.label}</div>
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="목표 반복 범위(메인)">
        <div className="grid grid-cols-3 gap-2">
          {(custom.main_goal === "strength"
            ? ["1-3","3-5","4-6","1-6"]
            : ["6-8","8-10","10-12","6-12"]
          ).map((z) => (
            <Chip key={z} active={custom.target_rep_zone === z} onClick={() => setCustom((a) => ({ ...a, target_rep_zone: z }))}>
              <div className="text-center text-sm font-semibold">{z.replace("-", "~")}회</div>
            </Chip>
          ))}
        </div>
      </Group>


      <button
        disabled={starting}
        onClick={onSubmit}
        className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-40"
      >
        {starting ? "생성 중…" : "루틴 생성"}
      </button>
    </div>
  );
}

function DatePickerField({
  value, onChange, placeholder, clearable,
}: { value: string | null; onChange: (v: string | null) => void; placeholder: string; clearable?: boolean }) {
  const date = value ? new Date(value + "T00:00:00") : undefined;
  return (
    <div className="flex gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {date ? format(date, "yyyy-MM-dd") : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => onChange(d ? d.toISOString().slice(0, 10) : null)}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <button
          onClick={() => onChange(null)}
          className="rounded-xl border border-border bg-card px-3 text-xs text-muted-foreground"
        >지우기</button>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-3 text-left ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
