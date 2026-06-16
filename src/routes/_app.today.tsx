import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { EmojiScale } from "@/components/EmojiScale";
import { SPORT_LABELS, FATIGUE_LABELS } from "@/lib/types";
import {
  calculateTodayExercise,
  isRecoveryDay,
  SPORT_MULT,
  FATIGUE_MULT,
  calcWeightScore,
  calcSportScore,
  nbBucket,
  type PrescribedExercise,
  type TemplateExerciseLike,
} from "@/lib/calc";
import {
  carryOverDay,
  carryOverExercise,
  getCarriedInLedger,
  getCarriedOutLedger,
  buildCarriedInMap,
  nextDayStr,
  addDaysStr,
  type CarryoverLedger,
} from "@/lib/carryover";
import { toast } from "sonner";
import { Check, Star, Plus, X, ChevronDown, ChevronUp, CornerUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CelebrationModal } from "@/components/CelebrationModal";
import { CarryoverDateDialog } from "@/components/CarryoverDateDialog";
import { TrialBanner } from "@/components/TrialBanner";
import { groupForExercise } from "@/lib/exercise-options";
import { isMainLift, type MainLogV1 } from "@/lib/main-lift";
import { MainLiftCompact } from "@/components/MainLiftCompact";
import { AccessoryCompact } from "@/components/AccessoryCompact";
import { type Condition } from "@/lib/condition";

import type { MainGoal } from "@/lib/goal-ranges";
import { recomputeAndStoreE1rm } from "@/lib/e1rm";
import { PageLoading } from "@/components/PageLoading";


export const Route = createFileRoute("/_app/today")({
  component: TodayPage,
});

interface ActiveTemplate {
  id: string;
  template_id: string;
  start_date: string;
  current_week: number;
  routine_templates: { template_name: string; duration_weeks: number } | null;
}

interface DayData {
  id: string;
  day_title: string;
  is_rest_day: boolean;
  week_number: number;
  day_of_week: number;
}

interface SetEntry {
  weight: number;
  reps: number;
  completed: boolean;
}

const DOW_KO = ["", "월", "화", "수", "목", "금", "토", "일"];

const CELEBRATION_MESSAGES = [
  { emoji: "🎉", title: "오늘도 해내셨군요!", desc: "축하드립니다! 정말 잘하셨어요." },
  { emoji: "💪", title: "오늘 운동 완료!", desc: "영양도 잘 챙기고 푹 쉬세요." },
  { emoji: "🛌", title: "오늘 훈련 완료!", desc: "회복까지가 훈련입니다." },
  { emoji: "🥗", title: "좋습니다!", desc: "식사와 수면까지 챙기면 완벽해요." },
  { emoji: "🔥", title: "끝까지 해냈네요!", desc: "내일도 좋은 컨디션으로 가봅시다." },
];
let _celebIdx = 0;
type CelebPayload = (typeof CELEBRATION_MESSAGES)[number];
function nextCeleb(): CelebPayload {
  const m = CELEBRATION_MESSAGES[_celebIdx % CELEBRATION_MESSAGES.length];
  _celebIdx++;
  return m;
}

let _celebHandler: ((p: CelebPayload) => void) | null = null;
function celebrate() {
  const p = nextCeleb();
  if (_celebHandler) _celebHandler(p);
  else toast.success(p.title);
}



export function TodayPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [profileName, setProfileName] = useState("");
  const [active, setActive] = useState<ActiveTemplate | null>(null);
  const [day, setDay] = useState<DayData | null>(null);
  const [exercises, setExercises] = useState<TemplateExerciseLike[]>([]);
  const [e1rms, setE1rms] = useState<Record<string, number>>({});
  const [checkin, setCheckin] = useState<{ sport: number; fatigue: number } | null>(null);
  const [sport, setSport] = useState<number | null>(null);
  const [fatigue, setFatigue] = useState<number | null>(null);
  const [logs, setLogs] = useState<Record<string, any>>({});
  const [customLogs, setCustomLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateLoading, setDateLoading] = useState(false);
  const [savingCheck, setSavingCheck] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [autoWeek, setAutoWeek] = useState(1);
  const [weekOverview, setWeekOverview] = useState<
    Record<number, { day: DayData; exercises: { exercise_name: string; base_sets: number; base_reps: number }[] }[]> | null
  >(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [carriedLedger, setCarriedLedger] = useState<CarryoverLedger[]>([]);
  const [carriedOutLedger, setCarriedOutLedger] = useState<CarryoverLedger[]>([]);
  const [celeb, setCeleb] = useState<CelebPayload | null>(null);
  const [carryDayOpen, setCarryDayOpen] = useState(false);
  const [carryExercise, setCarryExercise] = useState<{ logId: string; name: string; templateExerciseId: string | null } | null>(null);
  const [nextPreview, setNextPreview] = useState<{ date: string; dow: number; title: string; exercises: { exercise_name: string; base_sets: number; base_reps: number }[] } | null>(null);
  const [assignmentMap, setAssignmentMap] = useState<Record<string, number | null> | null>(null);
  const [mainGoal, setMainGoal] = useState<MainGoal>("hypertrophy");
  const [mainRepLow, setMainRepLow] = useState<number>(8);
  const [mainRepHigh, setMainRepHigh] = useState<number>(10);
  const [condition] = useState<Condition | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showAccessories, setShowAccessories] = useState(false);




  const celebratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    _celebHandler = (p) => setCeleb(p);
    return () => { _celebHandler = null; };
  }, []);


  const actualTodayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [todayStr, setTodayStr] = useState(actualTodayStr);
  const today = useMemo(() => new Date(todayStr + "T00:00:00"), [todayStr]);
  const dowJs = today.getDay();
  const dow = dowJs === 0 ? 7 : dowJs;
  const isViewingToday = todayStr === actualTodayStr;

  async function loadWeekDay(at: ActiveTemplate, week: number) {
    const { data: dayData } = await supabase
      .from("template_days")
      .select("*")
      .eq("template_id", at.template_id)
      .eq("week_number", week)
      .eq("day_of_week", dow)
      .maybeSingle();

    let useDay = dayData;
    if (!useDay) {
      const { data: fb } = await supabase
        .from("template_days")
        .select("*")
        .eq("template_id", at.template_id)
        .eq("week_number", 1)
        .eq("day_of_week", dow)
        .maybeSingle();
      useDay = fb;
    }
    if (useDay) {
      setDay(useDay as DayData);
      if (!useDay.is_rest_day) {
        const { data: ex } = await supabase
          .from("template_exercises")
          .select("*")
          .eq("template_day_id", useDay.id)
          .order("order_index");
        setExercises((ex ?? []) as TemplateExerciseLike[]);
      } else {
        setExercises([]);
      }
    } else {
      setDay(null);
      setExercises([]);
    }
  }

  async function loadSelectedDate(at: ActiveTemplate, dateStr: string) {
    if (!user) return;
    setDateLoading(true);

    const selected = new Date(dateStr + "T00:00:00");
    const selectedDowJs = selected.getDay();
    const fallbackDow = selectedDowJs === 0 ? 7 : selectedDowJs;
    // Apply user's weekday remap from snapshot assignment, if any.
    // assignmentMap keys are 0..6 (Sun..Sat); values are template day_of_week (1..7) or null.
    const mapped = assignmentMap ? assignmentMap[String(selectedDowJs)] : undefined;
    const hasMap = assignmentMap != null;
    const selectedDow = hasMap ? (mapped ?? -1) : fallbackDow; // -1 means rest for this user
    const start = new Date(at.start_date + "T00:00:00");
    const diffDays = Math.floor((selected.getTime() - start.getTime()) / 86400000);
    const totalWeeks = at.routine_templates?.duration_weeks ?? 4;
    const week = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), totalWeeks);
    setCurrentWeek(week);

    const { data: dayData } = selectedDow > 0
      ? await supabase
          .from("template_days")
          .select("*")
          .eq("template_id", at.template_id)
          .eq("week_number", week)
          .eq("day_of_week", selectedDow)
          .maybeSingle()
      : { data: null };
    const useDay = dayData as DayData | null;
    setDay(useDay);

    const [exRes, logsRes, checkinRes, ledger, outLedger] = await Promise.all([
      useDay && !useDay.is_rest_day
        ? supabase
            .from("template_exercises")
            .select("*")
            .eq("template_day_id", useDay.id)
            .order("order_index")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("workout_logs").select("*").eq("athlete_id", user.id).eq("date", dateStr),
      supabase
        .from("daily_checkins")
        .select("sport_intensity, fatigue_level")
        .eq("athlete_id", user.id)
        .eq("date", dateStr)
        .maybeSingle(),
      getCarriedInLedger(user.id, dateStr),
      getCarriedOutLedger(user.id, dateStr),
    ]);

    const dateExercises = (exRes.data ?? []) as TemplateExerciseLike[];
    const dateExerciseIds = new Set(dateExercises.map((e) => e.id));
    setExercises(dateExercises);
    const lmap: Record<string, any> = {};
    const customs: any[] = [];
    (logsRes.data ?? []).forEach((l: any) => {
      if (l.template_exercise_id && dateExerciseIds.has(l.template_exercise_id)) lmap[l.template_exercise_id] = l;
      else customs.push(l);
    });
    setLogs(lmap);
    setCustomLogs(customs);
    if (checkinRes.data) {
      setCheckin({ sport: checkinRes.data.sport_intensity, fatigue: checkinRes.data.fatigue_level });
      setSport(checkinRes.data.sport_intensity);
      setFatigue(checkinRes.data.fatigue_level);
    } else {
      setCheckin(null);
      setSport(null);
      setFatigue(null);
    }
    setCarriedLedger(ledger);
    setCarriedOutLedger(outLedger);
    setDateLoading(false);
  }

  async function loadWeekOverview(at: ActiveTemplate, week: number) {
    setOverviewLoading(true);
    const { data: days } = await supabase
      .from("template_days")
      .select("*")
      .eq("template_id", at.template_id)
      .eq("week_number", week)
      .order("day_of_week");
    const dayIds = (days ?? []).map((d: any) => d.id);
    const { data: exs } = dayIds.length
      ? await supabase
          .from("template_exercises")
          .select("template_day_id, exercise_name, base_sets, base_reps, order_index")
          .in("template_day_id", dayIds)
          .order("order_index")
      : { data: [] as any[] };
    const grouped: { day: DayData; exercises: any[] }[] = (days ?? []).map((d: any) => ({
      day: d as DayData,
      exercises: (exs ?? []).filter((e: any) => e.template_day_id === d.id),
    }));
    setWeekOverview((s) => ({ ...(s ?? {}), [week]: grouped }));
    setOverviewLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const [profileRes, activeRes, liftRes, assignRes] = await Promise.all([
        supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
        supabase
          .from("athlete_active_template")
          .select("*, routine_templates(template_name, duration_weeks)")
          .eq("athlete_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("athlete_lifts")
          .select("lift_type, e1rm")
          .eq("athlete_id", user.id)
          .eq("is_current", true),
        supabase
          .from("athlete_routine_assignments")
          .select("weekday_map, main_goal, main_rep_low, main_rep_high")
          .eq("athlete_id", user.id)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (!mounted) return;

      setProfileName(profileRes.data?.name ?? "");
      const e: Record<string, number> = {};
      (liftRes.data ?? []).forEach((r: any) => (e[r.lift_type] = Number(r.e1rm)));
      setE1rms(e);
      setAssignmentMap(((assignRes.data as any)?.weekday_map as Record<string, number | null>) ?? null);
      const ar: any = assignRes.data ?? {};
      const g: MainGoal = ar.main_goal === "strength" ? "strength" : "hypertrophy";
      setMainGoal(g);
      setMainRepLow(ar.main_rep_low ?? (g === "strength" ? 3 : 8));
      setMainRepHigh(ar.main_rep_high ?? (g === "strength" ? 5 : 10));




      if (activeRes.data) {
        const at = activeRes.data as any as ActiveTemplate;
        setActive(at);
        const start = new Date(at.start_date + "T00:00:00");
        const actualToday = new Date(actualTodayStr + "T00:00:00");
        const diffDays = Math.floor((actualToday.getTime() - start.getTime()) / 86400000);
        const totalWeeks = at.routine_templates?.duration_weeks ?? 4;
        const week = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), totalWeeks);
        setAutoWeek(week);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reload day data when active template or selected date changes
  useEffect(() => {
    if (active) loadSelectedDate(active, todayStr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, todayStr, assignmentMap]);

  async function selectWeek(w: number) {
    if (!active) return;
    setCurrentWeek(w);
    await loadWeekOverview(active, w);
  }

  async function saveCheckin() {
    if (!user || !sport || !fatigue) return;
    setSavingCheck(true);
    const { error } = await supabase.from("daily_checkins").upsert(
      { athlete_id: user.id, date: todayStr, sport_intensity: sport, fatigue_level: fatigue },
      { onConflict: "athlete_id,date" },
    );
    setSavingCheck(false);
    if (error) return toast.error(error.message);
    setCheckin({ sport, fatigue });
    toast.success("루틴이 오늘 컨디션에 맞춰 조정됨");
  }

  async function upsertLog(p: PrescribedExercise, patch: Record<string, any>) {
    if (!user) return;
    const existing = logs[p.exercise_id];
    const exerciseName = prescribedDisplayName(p);
    const base = {
      athlete_id: user.id,
      date: todayStr,
      template_exercise_id: p.exercise_id,
      exercise_name: exerciseName,
      planned_sets: p.sets,
      planned_reps: p.reps,
      planned_weight: p.weight,
    };
    if (existing) {
      const { data } = await supabase
        .from("workout_logs")
        .update(patch as any)
        .eq("id", existing.id)
        .select()
        .single();
      if (data) setLogs((s) => ({ ...s, [p.exercise_id]: data }));
    } else {
      const { data } = await supabase
        .from("workout_logs")
        .insert({ ...base, ...patch } as any)
        .select()
        .single();
      if (data) setLogs((s) => ({ ...s, [p.exercise_id]: data }));
    }
  }

  async function updateCustom(id: string, patch: Record<string, any>) {
    const { data } = await supabase
      .from("workout_logs")
      .update(patch as any)
      .eq("id", id)
      .select()
      .single();
    if (data) setCustomLogs((s) => s.map((x) => (x.id === id ? data : x)));
  }

  async function deleteCustom(id: string) {
    await supabase.from("workout_logs").delete().eq("id", id);
    setCustomLogs((s) => s.filter((x) => x.id !== id));
  }

  async function addCustom(name: string, sets: number, reps: number, weight: number) {
    if (!user) return;
    const initSets: SetEntry[] = Array.from({ length: Math.max(1, sets) }).map(() => ({
      weight,
      reps,
      completed: false,
    }));
    const { data } = await supabase
      .from("workout_logs")
      .insert({
        athlete_id: user.id,
        date: todayStr,
        exercise_name: name,
        planned_sets: sets,
        planned_reps: reps,
        planned_weight: weight,
        set_logs: initSets as any,
      })
      .select()
      .single();
    if (data) setCustomLogs((s) => [...s, data]);
  }

  async function doCarryDay(to: string) {
    if (!user) return;
    try {
      const { moved } = await carryOverDay(user.id, todayStr, to, day?.id ?? null);
      if (moved === 0) toast("이월할 미완료 운동이 없습니다.");
      else toast.success(`${moved}개 운동을 ${to}로 이월했어요.`);
      if (active) await loadSelectedDate(active, todayStr);
    } catch (e: any) {
      toast.error(e.message ?? "이월 실패");
    }
  }

  async function doCarryExercise(logId: string, exerciseName: string, to: string, templateExerciseId: string | null = null) {
    if (!user) return;
    try {
      await carryOverExercise(logId, user.id, todayStr, to, exerciseName, templateExerciseId);
      toast.success(`'${exerciseName}'을(를) ${to}로 이월했어요.`);
      if (active) await loadSelectedDate(active, todayStr);
    } catch (e: any) {
      toast.error(e.message ?? "이월 실패");
    }
  }

  // Ensure a workout_log exists for prescribed exercise (needed before carry-over)
  async function ensureLogForPrescribed(p: PrescribedExercise): Promise<string | null> {
    if (!user) return null;
    const existing = logs[p.exercise_id];
    if (existing?.id) return existing.id;
    const initSets: SetEntry[] = Array.from({ length: Math.max(1, p.sets) }).map(() => ({
      weight: p.weight, reps: p.reps, completed: false,
    }));
    const { data, error } = await supabase
      .from("workout_logs")
      .insert({
        athlete_id: user.id,
        date: todayStr,
        template_exercise_id: p.exercise_id,
        exercise_name: prescribedDisplayName(p),
        planned_sets: p.sets,
        planned_reps: p.reps,
        planned_weight: p.weight,
        set_logs: initSets as any,
      })
      .select()
      .single();
    if (error || !data) { toast.error("이월 준비 실패"); return null; }
    setLogs((s) => ({ ...s, [p.exercise_id]: data }));
    return data.id;
  }

  async function openCarryForPrescribed(p: PrescribedExercise) {
    const id = await ensureLogForPrescribed(p);
    if (id) setCarryExercise({ logId: id, name: prescribedDisplayName(p), templateExerciseId: p.exercise_id });
  }

  // Find the next planned non-rest day with exercises (for preview on rest/empty days)
  useEffect(() => {
    if (!active || !day) { setNextPreview(null); return; }
    if (!day.is_rest_day && exercises.length > 0) { setNextPreview(null); return; }
    let cancelled = false;
    (async () => {
      const start = new Date(active.start_date + "T00:00:00");
      const totalWeeks = active.routine_templates?.duration_weeks ?? 4;
      for (let i = 1; i <= 14; i++) {
        const cand = addDaysStr(todayStr, i);
        const cd = new Date(cand + "T00:00:00");
        const cdowJs = cd.getDay();
        const cdow = cdowJs === 0 ? 7 : cdowJs;
        const diffDays = Math.floor((cd.getTime() - start.getTime()) / 86400000);
        const week = Math.min(Math.max(Math.floor(diffDays / 7) + 1, 1), totalWeeks);
        const { data: cDay } = await supabase
          .from("template_days")
          .select("id, day_title, is_rest_day, day_of_week")
          .eq("template_id", active.template_id)
          .eq("week_number", week)
          .eq("day_of_week", cdow)
          .maybeSingle();
        if (!cDay || cDay.is_rest_day) continue;
        const { data: exs } = await supabase
          .from("template_exercises")
          .select("exercise_name, base_sets, base_reps")
          .eq("template_day_id", cDay.id)
          .order("order_index");
        if (cancelled) return;
        if (exs && exs.length > 0) {
          setNextPreview({ date: cand, dow: cdow, title: cDay.day_title || "세션", exercises: exs as any });
          return;
        }
      }
      if (!cancelled) setNextPreview(null);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, day, exercises.length, todayStr]);



  const totalWeeks = active?.routine_templates?.duration_weeks ?? 4;
  // Use live slider values if user is editing, otherwise fall back to saved checkin, else 3.
  const sIn = sport ?? checkin?.sport ?? 3;
  const fIn = fatigue ?? checkin?.fatigue ?? 3;
  const prescribed = exercises.map((e) => calculateTodayExercise(e, e1rms, sIn, fIn));
  const carriedOutTemplateIds = new Set(
    carriedOutLedger.flatMap((row) => {
      const entries = Array.isArray(row.adjusted_data) ? row.adjusted_data : row.adjusted_data ? [row.adjusted_data] : [];
      return entries.map((entry) => entry.template_exercise_id).filter((id): id is string => !!id);
    }),
  );
  const visiblePrescribed = prescribed.filter((p) => !carriedOutTemplateIds.has(p.exercise_id));
  const sportMult = SPORT_MULT[sIn] ?? 1;
  const fatigueObj = FATIGUE_MULT[fIn] ?? FATIGUE_MULT[3];
  const volume = Math.round(sportMult * fatigueObj.sets * 100);
  const intensity = Math.round(fatigueObj.weight * 100);
  const allRoutineItems = [
    ...visiblePrescribed.filter((p) => !p.skipped).map((p) => logs[p.exercise_id]),
    ...customLogs,
  ];
  const hasPlannedWorkout = !day?.is_rest_day && exercises.length > 0;
  const hasDisplayableRoutine = hasPlannedWorkout || customLogs.length > 0;
  const totalCount = allRoutineItems.length;
  const doneCount = allRoutineItems.filter((l) => l?.completed).length;
  const allComplete = totalCount > 0 && doneCount === totalCount;
  const { logIds: carriedInIds, templateExerciseIds: carriedInTemplateIds } = buildCarriedInMap(carriedLedger);

  // ===== Neural Budget (expected) =====
  const nbWeightScore = useMemo(() => {
    const exs = visiblePrescribed
      .filter((p) => !p.skipped)
      .map((p) => ({
        lift_type: p.lift_type,
        e1rm: p.e1rm_used,
        sets: Array.from({ length: p.sets }).map(() => ({ reps: p.reps, weight: p.weight })),
      }));
    return calcWeightScore(exs);
  }, [visiblePrescribed]);
  const nbSportScore = checkin ? calcSportScore(checkin.sport) : 0;
  const nbTotal = Math.round((nbWeightScore + nbSportScore) * 10) / 10;
  const nbBkt = nbBucket(nbTotal);
  const nbPct = Math.min(100, Math.round((nbTotal / 100) * 100));

  // weekly NB sum
  const [weekNB, setWeekNB] = useState<number>(0);
  useEffect(() => {
    if (!user) return;
    const t = new Date(todayStr + "T00:00:00");
    const dayIdx = (t.getDay() + 6) % 7;
    const monday = new Date(t); monday.setDate(t.getDate() - dayIdx);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    supabase.from("neural_budget_daily")
      .select("total_score").eq("athlete_id", user.id)
      .gte("date", fmt(monday)).lte("date", fmt(sunday))
      .then(({ data }) => {
        const sum = (data ?? []).reduce((s: number, r: any) => s + Number(r.total_score || 0), 0);
        setWeekNB(Math.round(sum * 10) / 10);
      });
  }, [user, todayStr, allComplete]);

  // Persist NB on completion
  useEffect(() => {
    if (!user || !allComplete || !checkin) return;
    supabase.from("neural_budget_daily").upsert(
      {
        athlete_id: user.id,
        date: todayStr,
        weight_score: nbWeightScore,
        sport_score: nbSportScore,
        total_score: nbTotal,
      } as any,
      { onConflict: "athlete_id,date" },
    ).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allComplete, user, todayStr]);

  // Fire celebration only once per day, when all exercises complete
  useEffect(() => {
    if (allComplete && celebratedKeyRef.current !== todayStr) {
      celebratedKeyRef.current = todayStr;
      celebrate();
    }
    if (!allComplete && celebratedKeyRef.current === todayStr) {
      // user uncompleted something — allow re-fire later
      celebratedKeyRef.current = null;
    }
  }, [allComplete, todayStr]);

  if (loading) return <PageLoading message="오늘 운동 불러오는 중" />;

  if (!active) {
    return (
      <div className="container-mobile py-10">
        <h1 className="num text-2xl">루틴을 먼저 만들어 주세요</h1>
        <button
          onClick={() => nav({ to: "/templates" })}
          className="mt-6 w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground"
        >
          루틴 만들러 가기
        </button>

      </div>
    );
  }


  return (
    <div className="container-mobile py-6 pb-24">
      <TrialBanner />

      {/* Header */}
      <div>
        <div className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-2">
          <button
            type="button"
            onClick={() => setTodayStr((s) => addDaysStr(s, -1))}
            aria-label="이전 날짜"
            data-testid="today-prev-date"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground active:scale-95"
          >
            <ChevronLeft size={20} />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                data-testid="today-current-date"
                className={`flex-1 rounded-xl border px-3 py-2 text-center ${
                  isViewingToday ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"
                }`}
              >
                <div className="text-sm font-semibold">
                  {today.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
                </div>
                <div className="text-[10px] text-muted-foreground">{isViewingToday ? "오늘" : "탭하여 날짜 선택"}</div>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={today}
                onSelect={(picked) => {
                  if (!picked) return;
                  const y = picked.getFullYear();
                  const m = String(picked.getMonth() + 1).padStart(2, "0");
                  const d = String(picked.getDate()).padStart(2, "0");
                  setTodayStr(`${y}-${m}-${d}`);
                }}
              />
              <div className="border-t border-border p-2">
                <button
                  type="button"
                  onClick={() => setTodayStr(actualTodayStr)}
                  className="w-full rounded-lg bg-primary/10 py-2 text-sm font-semibold text-primary"
                >
                  오늘로 이동
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <button
            type="button"
            onClick={() => setTodayStr((s) => addDaysStr(s, 1))}
            aria-label="다음 날짜"
            data-testid="today-next-date"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-foreground active:scale-95"
          >
            <ChevronRight size={20} />
          </button>
        </div>


        {active.routine_templates && (
          <div className="mt-3 rounded-xl border border-border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">현재 진행 루틴</div>
                <div className="mt-0.5 truncate font-bold">{active.routine_templates.template_name}</div>
              </div>
              <div className="shrink-0 text-xs font-semibold text-primary">{doneCount}/{totalCount} 완료</div>
            </div>

            {/* Week pills */}
            <div className="-mx-1 mt-3 flex flex-wrap gap-1 px-1">
              {Array.from({ length: totalWeeks }).map((_, i) => {
                const w = i + 1;
                const isActive = w === currentWeek;
                const isAuto = w === autoWeek;
                return (
                  <button
                    key={w}
                    onClick={() => selectWeek(w)}
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                      isActive
                        ? "border-primary bg-primary/15 text-primary font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {w}주차{isAuto ? " ·진행중" : ""}
                  </button>
                );
              })}
            </div>

            {/* Week overview (collapsible) */}
            {weekOverview?.[currentWeek] && (
              <div className="mt-3 rounded-lg border border-border bg-secondary/40 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-semibold">{currentWeek}주차 전체 계획</span>
                  <button
                    onClick={() => setWeekOverview((s) => {
                      if (!s) return s;
                      const { [currentWeek]: _, ...rest } = s;
                      return rest;
                    })}
                    className="flex items-center gap-0.5 text-[10px] text-muted-foreground"
                  >
                    <ChevronUp size={12} /> 접기
                  </button>
                </div>
                <div className="space-y-1.5">
                  {weekOverview[currentWeek].map(({ day: d, exercises: dex }) => (
                    <div key={d.id} className="rounded-md bg-background/60 p-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold">
                          {DOW_KO[d.day_of_week]} · {d.day_title || (d.is_rest_day ? "휴식" : "세션")}
                        </span>
                        {d.day_of_week === dow && (
                          <span className="text-[9px] font-bold text-primary">오늘</span>
                        )}
                      </div>
                      {d.is_rest_day ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">휴식일</div>
                      ) : dex.length === 0 ? (
                        <div className="mt-0.5 text-[11px] text-muted-foreground">운동 없음</div>
                      ) : (
                        <ul className="mt-1 space-y-0.5">
                          {dex.map((ex: any, i: number) => (
                            <li key={i} className="text-[11px] text-muted-foreground">
                              · {ex.exercise_name} ({ex.base_reps}회 × {ex.base_sets}세트)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!weekOverview?.[currentWeek] && (
              <button
                onClick={() => active && loadWeekOverview(active, currentWeek)}
                className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-border py-1.5 text-[11px] text-muted-foreground"
              >
                <ChevronDown size={12} /> {currentWeek}주차 전체 보기
                {overviewLoading && " ..."}
              </button>
            )}

          </div>

        )}
      </div>

      {/* Rest day */}
      {/* Rest day OR no plan for this date → show preview of next workout */}
      {(day?.is_rest_day || (!day) || (!day.is_rest_day && exercises.length === 0)) && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <div className="text-5xl">{day?.is_rest_day ? "😌" : "📅"}</div>
          <h2 className="mt-3 text-xl font-bold">
            {day?.is_rest_day ? "이 날은 휴식일이에요" : "이 날엔 계획된 운동이 없어요"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">좌/우 화살표로 다른 날짜를 확인할 수 있어요</p>
          {nextPreview && (
            <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-left">
              <div className="text-[11px] text-muted-foreground">다음 운동 미리보기</div>
              <div className="mt-0.5 flex items-baseline justify-between">
                <div className="font-bold">
                  {new Date(nextPreview.date + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })} · {nextPreview.title}
                </div>
                <button
                  onClick={() => setTodayStr(nextPreview.date)}
                  className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground"
                >
                  이동
                </button>
              </div>
              <ul className="mt-2 space-y-0.5">
                {nextPreview.exercises.slice(0, 6).map((e, i) => (
                  <li key={i} className="text-xs text-muted-foreground">· {e.exercise_name} ({e.base_reps}회 × {e.base_sets}세트)</li>
                ))}
                {nextPreview.exercises.length > 6 && (
                  <li className="text-xs text-muted-foreground">· 외 {nextPreview.exercises.length - 6}개</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}


      {/* Checkin */}
      {hasPlannedWorkout && (
        <>
          <section className="mt-6">
            <h2 className="mb-3 font-bold">컨디션 반영</h2>
            <h3 className="mb-3 text-sm font-semibold">오늘 종목 훈련 강도는?</h3>
            <EmojiScale value={sport} onChange={setSport} labels={SPORT_LABELS} />
          </section>
          <section className="mt-4">
            <h2 className="mb-3 font-bold">지금 피로도는?</h2>
            <EmojiScale value={fatigue} onChange={setFatigue} labels={FATIGUE_LABELS} />
          </section>

          {sport && fatigue && isRecoveryDay(sport, fatigue) && (
            <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              ⚠ 오늘은 회복일을 강력히 추천드립니다.
            </div>
          )}

          <button
            disabled={!sport || !fatigue || savingCheck}
            onClick={saveCheckin}
            className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-40"
          >
            컨디션에 따른 루틴 조정
          </button>
          {!checkin && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              아래는 기본 계획 루틴입니다. 컨디션을 입력하면 자동 조정됩니다.
            </p>
          )}
        </>
      )}

      {/* Prescribed routine */}
      {hasDisplayableRoutine && (() => {
        const activeP = visiblePrescribed.filter((p) => !p.skipped);
        const totalVolume = activeP.reduce((sum, p) => sum + p.sets * p.reps * Math.max(p.weight, 1), 0);
        const mainCount = activeP.filter((p) => p.priority >= 3).length;
        // 5-tier intensity label combining volume, exercise count, and main-lift share
        const exCount = activeP.length;
        const mainRatio = exCount > 0 ? mainCount / exCount : 0;
        const score = totalVolume / 1000 + exCount * 0.5 + mainRatio * 3;
        let level: "약" | "중약" | "중" | "중강" | "강";
        let levelColor: string;
        if (score >= 14) { level = "강"; levelColor = "text-destructive border-destructive/40 bg-destructive/10"; }
        else if (score >= 10) { level = "중강"; levelColor = "text-warning border-warning/40 bg-warning/10"; }
        else if (score >= 6) { level = "중"; levelColor = "text-primary border-primary/40 bg-primary/10"; }
        else if (score >= 3) { level = "중약"; levelColor = "text-blue-700 border-blue-400/40 bg-blue-500/10"; }
        else { level = "약"; levelColor = "text-muted-foreground border-border bg-secondary"; }
        return (
        <section className="mt-6">
          <div className="mb-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-bold">오늘 회복 예산</div>
              <div className={`text-sm font-bold ${nbBkt.color}`}>{nbBkt.label}</div>
            </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full w-full ${nbBkt.bar}`}
                  style={{ transform: `scaleX(${nbPct / 100})`, transformOrigin: "left" }}
                />
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              그날의 운동량·작업중량·컨디션을 합산한 예상 부담입니다. 기록 화면에서 일별 추세를 볼 수 있어요.
            </div>
          </div>
          <div className={`mb-3 rounded-xl border p-3 text-center text-sm font-bold ${levelColor}`}>
            오늘 훈련 강도: {level}
          </div>
          {allComplete && (
            <div className="mb-4 rounded-2xl border border-primary bg-gradient-to-r from-primary/20 to-primary/5 p-5 text-center">
              <div className="text-3xl">👏</div>
              <div className="mt-2 text-lg font-bold text-primary">오늘 루틴 완료!</div>
              <div className="mt-1 text-sm text-muted-foreground">정말 잘하셨습니다</div>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">
              오늘 루틴 <span className="text-xs text-muted-foreground">({doneCount}/{totalCount})</span>
            </h2>
            <button
              onClick={() => setCarryDayOpen(true)}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              title="미완료 루틴을 다른 날로 이월"
            >
              <CornerUpRight size={14} /> 이월
            </button>
          </div>

          {carriedInIds.size > 0 && (
            <div className="mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              ↪ 이전 날짜에서 이월된 운동 {carriedInIds.size}개가 오늘에 포함되어 있습니다.
            </div>
          )}
          {checkin && (() => {
            const volLabel = volume >= 100 ? "기본" : volume >= 85 ? "약간 감량" : volume >= 65 ? "감량" : "큰 감량";
            const intLabel = intensity >= 100 ? "기본" : intensity >= 95 ? "약간 가볍게" : intensity >= 85 ? "가볍게" : "많이 가볍게";
            return (
              <div className="mb-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs font-semibold text-primary">
                종목강도 {SPORT_LABELS[sIn - 1]} + 피로도 {FATIGUE_LABELS[fIn - 1]} → 볼륨 {volLabel} / 무게 {intLabel}
              </div>
            );
          })()}
          {(() => {
            const sorted = [...visiblePrescribed].sort(
              (a, b) => Number(a.skipped) - Number(b.skipped) || b.priority - a.priority,
            );
            const mains = sorted.filter((p) => isMainLift(p.lift_type));
            const accs = sorted.filter((p) => !isMainLift(p.lift_type));
            const accsDoneCount = accs.filter((p) => !!logs[p.exercise_id]?.completed).length;
            const customsDoneCount = customLogs.filter((c) => !!c.completed).length;

            const renderEx = (p: typeof sorted[number]) => {
              const log = logs[p.exercise_id];
              const key = `ex:${p.exercise_id}`;
              return (
                <ExerciseCard
                  key={p.exercise_id}
                  p={p}
                  log={log}
                  carriedIn={(!!log?.id && carriedInIds.has(log.id)) || carriedInTemplateIds.has(p.exercise_id)}
                  goal={mainGoal}
                  repLow={mainRepLow}
                  repHigh={mainRepHigh}
                  condition={condition}
                  expanded={expandedKey === key}
                  onToggle={() => setExpandedKey((k) => (k === key ? null : key))}
                  onPatch={(patch) => upsertLog(p, patch)}
                  onCarryover={() => openCarryForPrescribed(p)}
                />
              );
            };

            return (
              <>
                <div className="space-y-3">{mains.map(renderEx)}</div>

                {(accs.length > 0 || customLogs.length > 0) && (
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowAccessories((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
                    >
                      <span>보조운동 / 자유운동 ({accsDoneCount + customsDoneCount}/{accs.length + customLogs.length})</span>
                      <span className="text-xs text-muted-foreground">{showAccessories ? "접기" : "보기"}</span>
                    </button>
                    {showAccessories && (
                      <div className="mt-3 space-y-3">
                        {accs.map(renderEx)}
                        {customLogs.map((c) => (
                          <CustomCard
                            key={c.id}
                            log={c}
                            carriedIn={carriedInIds.has(c.id)}
                            onPatch={(patch) => updateCustom(c.id, patch)}
                            onDelete={() => deleteCustom(c.id)}
                            onCarryover={() => setCarryExercise({ logId: c.id, name: c.exercise_name, templateExerciseId: null })}
                          />
                        ))}
                        <button
                          onClick={() => setShowAdd(true)}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 py-3 text-xs text-primary"
                        >
                          <Plus size={14} /> 자유운동 추가
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            );
          })()}

        </section>
        );
      })()}

      {showAdd && (
        <AddExerciseModal
          onClose={() => setShowAdd(false)}
          onAdd={(n, s, r, w) => {
            addCustom(n, s, r, w);
            setShowAdd(false);
          }}
        />
      )}

      <CarryoverDateDialog
        open={carryDayOpen}
        fromDate={todayStr}
        title="미완료 루틴 전체 이월"
        description="미완료된 운동을 원하는 날짜로 옮깁니다."
        onClose={() => setCarryDayOpen(false)}
        onConfirm={(to) => doCarryDay(to)}
      />
      <CarryoverDateDialog
        open={!!carryExercise}
        fromDate={todayStr}
        title={carryExercise ? `'${carryExercise.name}' 이월` : ""}
        description="이 운동만 다른 날짜로 옮깁니다."
        onClose={() => setCarryExercise(null)}
        onConfirm={async (to) => { if (carryExercise) await doCarryExercise(carryExercise.logId, carryExercise.name, to, carryExercise.templateExerciseId); }}
      />
      <CelebrationModal
        open={!!celeb}
        emoji={celeb?.emoji}
        title={celeb?.title ?? ""}
        description={celeb?.desc}
        onClose={() => setCeleb(null)}
      />
    </div>

  );
}

// ============== Set Logger (inline per-set tracker) ==============
function SetLogger({
  initialSets,
  defaultWeight,
  defaultReps,
  onChange,
}: {
  initialSets: SetEntry[];
  defaultWeight: number;
  defaultReps: number;
  onChange: (sets: SetEntry[]) => void;
}) {
  const [sets, setSets] = useState<SetEntry[]>(initialSets);

  function update(next: SetEntry[]) {
    setSets(next);
    onChange(next);
  }
  function setField(idx: number, field: keyof SetEntry, val: any) {
    const next = sets.map((s, i) => (i === idx ? { ...s, [field]: val } : s));
    update(next);
  }
  function addSet() {
    const last = sets[sets.length - 1];
    update([
      ...sets,
      { weight: last?.weight ?? defaultWeight, reps: last?.reps ?? defaultReps, completed: false },
    ]);
  }
  function removeSet(idx: number) {
    update(sets.filter((_, i) => i !== idx));
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="grid grid-cols-[28px_1fr_1fr_36px_28px] items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
        <span>#</span>
        <span className="text-center">무게(kg)</span>
        <span className="text-center">횟수</span>
        <span className="text-center">완료</span>
        <span></span>
      </div>
      {sets.map((s, i) => (
        <div key={i} className="grid grid-cols-[28px_1fr_1fr_36px_28px] items-center gap-1.5">
          <span className={`text-center text-xs font-semibold ${s.completed ? "text-primary" : "text-muted-foreground"}`}>
            {i + 1}
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={s.weight}
            onChange={(e) => setField(i, "weight", parseFloat(e.target.value) || 0)}
            className={`w-full rounded-md border bg-secondary px-2 py-1.5 text-center text-sm outline-none focus:border-primary ${
              s.completed ? "border-primary/40" : "border-border"
            }`}
          />
          <input
            type="number"
            inputMode="numeric"
            value={s.reps}
            onChange={(e) => setField(i, "reps", parseInt(e.target.value) || 0)}
            className={`w-full rounded-md border bg-secondary px-2 py-1.5 text-center text-sm outline-none focus:border-primary ${
              s.completed ? "border-primary/40" : "border-border"
            }`}
          />
          <button
            onClick={() => setField(i, "completed", !s.completed)}
            className={`flex h-8 w-9 items-center justify-center rounded-md border-2 transition-all ${
              s.completed
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-secondary"
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button
            onClick={() => removeSet(i)}
            className="flex h-8 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addSet}
        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus size={12} /> 세트 추가
      </button>
    </div>
  );
}

function initSetsFromPrescribed(p: PrescribedExercise): SetEntry[] {
  return Array.from({ length: Math.max(1, p.sets) }).map(() => ({
    weight: p.weight,
    reps: p.reps,
    completed: false,
  }));
}

function prescribedDisplayName(p: PrescribedExercise): string {
  if (p.lift_type === "pullup") return "Weighted Pull-up";
  if (p.lift_type === "dips") return "Weighted Dips";
  return p.name;
}

function ExerciseCard({
  p,
  log,
  carriedIn,
  goal,
  repLow,
  repHigh,
  condition,
  expanded,
  onToggle,
  onPatch,
  onCarryover,
}: {
  p: PrescribedExercise;
  log: any;
  carriedIn?: boolean;
  goal: MainGoal;
  repLow: number;
  repHigh: number;
  condition: Condition | null;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (patch: any) => void;
  onCarryover?: () => void;
}) {

  if (p.skipped) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 opacity-50">
        <div className="flex items-center gap-1">
          <span className="font-bold">{p.name}</span>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">{p.skipReason}</div>
      </div>
    );
  }

  const displayName = (log?.exercise_name as string | undefined) || prescribedDisplayName(p);
  const group = groupForExercise(p.lift_type, displayName);
  const isCompleted = !!log?.completed;

  // ── Main lift slot ────────────────────────────────────────────────
  if (isMainLift(p.lift_type)) {
    return (
      <div className="relative">
        {onCarryover && (
          <button
            onClick={onCarryover}
            className="absolute right-3 top-3 z-10 flex h-7 items-center gap-1 rounded-full border border-border bg-card/90 px-2 text-[10px] text-muted-foreground"
            title="이월"
          >
            <CornerUpRight size={11} /> 이월
          </button>
        )}
        <MainLiftCompact
          liftType={p.lift_type}
          exerciseName={displayName}
          e1rm={p.e1rm_used ?? 0}
          plannedSets={p.sets}
          plannedReps={p.reps}
          goal={goal}
          repLow={repLow}
          repHigh={repHigh}
          condition={condition}
          rawLog={log?.set_logs}
          completed={isCompleted}
          carriedIn={carriedIn}
          expanded={expanded}
          onToggle={onToggle}
          onChange={async (next: MainLogV1, opts) => {
            const completed = next.working_sets.filter((s) => s.completed);
            const last = completed[completed.length - 1];
            await onPatch({

              set_logs: next as any,
              actual_sets: completed.length || null,
              actual_reps: last?.reps ?? null,
              actual_weight: last?.weight ?? next.actual_selected_weight ?? null,
              ...(opts?.complete ? { completed: true, skipped: false } : {}),
            });
            if (opts?.complete && isMainLift(p.lift_type)) {
              // In top_backoff mode, prefer the top set for e1RM (heavier signal).
              // In fixed_sets mode, use the last completed working set.
              const ref =
                next.execution_mode === "top_backoff" &&
                next.topset.actual_weight && next.topset.actual_reps
                  ? {
                      weight: Number(next.topset.actual_weight),
                      reps: Number(next.topset.actual_reps),
                      rir: next.topset.actual_rir ?? null,
                    }
                  : last && last.weight > 0 && last.reps > 0
                    ? { weight: last.weight, reps: last.reps, rir: last.rir }
                    : null;
              if (ref) {
                try {
                  const { data: { user: u } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
                  if (u) {
                    await recomputeAndStoreE1rm({
                      athleteId: u.id,
                      liftType: p.lift_type,
                      weight: ref.weight,
                      reps: ref.reps,
                      rir: ref.rir,
                      date: new Date().toISOString().slice(0, 10),
                    });
                  }
                } catch { /* non-blocking */ }
              }
            }
          }}
        />
      </div>
    );
  }

  // ── Accessory / self-selected slot ────────────────────────────────
  const savedSets: SetEntry[] | null =
    Array.isArray(log?.set_logs) && log.set_logs.length > 0 ? (log.set_logs as SetEntry[]) : null;
  const isBodyweight = p.lift_type === "pullup" || p.lift_type === "dips";

  return (
    <div className="relative">
      {onCarryover && (
        <button
          onClick={onCarryover}
          className="absolute right-3 top-3 z-10 flex h-7 items-center gap-1 rounded-full border border-border bg-card/90 px-2 text-[10px] text-muted-foreground"
          title="이월"
        >
          <CornerUpRight size={11} /> 이월
        </button>
      )}
      <AccessoryCompact
        exerciseName={displayName}
        plannedSets={p.sets}
        plannedReps={p.reps}
        plannedWeight={p.weight}
        isBodyweight={isBodyweight}
        group={group}
        savedSets={savedSets}
        completed={isCompleted}
        carriedIn={carriedIn}
        rirHint={2}
        expanded={expanded}
        onToggle={onToggle}
        onSelectExercise={(name) => onPatch({ exercise_name: name })}

        onSave={async (sets, complete, _lastRir) => {
          const completedSets = sets.filter((s) => s.completed);
          const lastDone = completedSets[completedSets.length - 1];
          await onPatch({
            set_logs: sets as any,
            actual_sets: completedSets.length || null,
            actual_reps: lastDone?.reps ?? null,
            actual_weight: lastDone?.weight ?? null,
            ...(complete ? { completed: true, skipped: false } : {}),
          });
        }}
      />
    </div>
  );
}


function CustomCard({
  log,
  carriedIn,
  onPatch,
  onDelete,
  onCarryover,
}: {
  log: any;
  carriedIn?: boolean;
  onPatch: (patch: any) => void;
  onDelete: () => void;
  onCarryover?: () => void;
}) {
  const setsArr: SetEntry[] =
    Array.isArray(log?.set_logs) && log.set_logs.length > 0
      ? (log.set_logs as SetEntry[])
      : [{ weight: Number(log.planned_weight) || 0, reps: log.planned_reps || 0, completed: false }];
  const isCompleted = !!log?.completed;
  const allDone = setsArr.length > 0 && setsArr.every((s) => s.completed);
  const isWeightedBodyweight = /Weighted Pull-up|Weighted Dips|풀업|딥스/i.test(log.exercise_name ?? "");

  function handleChange(next: SetEntry[]) {
    const completedSets = next.filter((s) => s.completed);
    const lastDone = completedSets[completedSets.length - 1];
    onPatch({
      set_logs: next as any,
      actual_sets: completedSets.length || null,
      actual_reps: lastDone?.reps ?? null,
      actual_weight: lastDone?.weight ?? null,
    });
  }

  async function handleComplete() {
    const next = setsArr.map((s) => ({ ...s, completed: true }));
    const lastDone = next[next.length - 1];
    await onPatch({
      set_logs: next as any,
      actual_sets: next.length,
      actual_reps: lastDone?.reps ?? null,
      actual_weight: lastDone?.weight ?? null,
      completed: true,
    });
  }

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isCompleted || allDone ? "border-primary/50 bg-primary/5" : "border-dashed border-border bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              직접 추가
            </span>
            <span className="font-bold">{log.exercise_name}</span>
            {carriedIn && (
              <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold text-warning">↪ 이월됨</span>
            )}
            {isCompleted && <span className="text-xs">✅</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            계획: {log.planned_reps}회 × {log.planned_sets}세트
            {log.planned_weight > 0 ? (isWeightedBodyweight ? ` + ${log.planned_weight}kg` : ` × ${log.planned_weight}kg`) : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onCarryover && (
            <button
              onClick={onCarryover}
              className="flex h-7 items-center gap-1 rounded-full border border-border px-2 text-[10px] text-muted-foreground"
              title="이 운동을 내일로 이월"
            >
              <CornerUpRight size={11} /> 이월
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <SetLogger
        key={log.id}
        initialSets={setsArr}
        defaultWeight={Number(log.planned_weight) || 0}
        defaultReps={log.planned_reps || 0}
        onChange={handleChange}
      />

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => { onPatch({ set_logs: setsArr as any }); toast("임시저장 완료"); }}
          className="rounded-lg border border-border bg-secondary py-2 text-xs font-semibold"
        >
          임시저장
        </button>
        <button
          onClick={handleComplete}
          disabled={isCompleted}
          className="rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {isCompleted ? "완료됨" : "완료"}
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] text-muted-foreground">{label}</div>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-2 py-2 text-center text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function AddExerciseModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, sets: number, reps: number, weight: number) => void;
}) {
  const [name, setName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("0");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-lg font-bold">운동 직접 추가</h3>
        <div className="mt-4 space-y-3">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">운동 이름</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 케이블 로우"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <NumField label="반복" value={reps} onChange={setReps} />
            <NumField label="세트" value={sets} onChange={setSets} />
            <NumField label="무게(kg)" value={weight} onChange={setWeight} step="0.5" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3">
            취소
          </button>
          <button
            disabled={!name.trim()}
            onClick={() =>
              onAdd(name.trim(), parseInt(sets) || 0, parseInt(reps) || 0, parseFloat(weight) || 0)
            }
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

