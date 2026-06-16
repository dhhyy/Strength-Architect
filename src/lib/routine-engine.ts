// Rule-based routine recommendation + snapshot builder
import type { LiftType } from "./types";

export type SeasonPhase = "offseason" | "preseason" | "inseason";
export type SportLoad = "low" | "medium" | "high" | "very_high";

export interface RoutinePrefs {
  season_phase: SeasonPhase;
  sport_training_load: SportLoad;
  desired_lifting_days: number;
  preferred_lifting_weekdays: number[]; // 0..6 (0=Sun, 1=Mon ... 6=Sat) — matches existing DB
  priority_lifts: LiftType[];
}

export interface TemplateLite {
  id: string;
  template_name: string;
  description: string | null;
  duration_weeks: number;
  split_type: string;
  days_per_week: number;
  difficulty_level: string;
  target_audience: string | null;
}

export interface TemplateDayLite {
  id: string;
  day_of_week: number; // 1..7 in DB (per existing template_days)
  week_number: number;
  is_rest_day: boolean;
  day_title: string;
}

export interface TemplateExerciseLite {
  id: string;
  template_day_id: string;
  exercise_name: string;
  lift_type: string;
  base_sets: number;
  base_reps: number;
  base_intensity_percent: number | null;
  fixed_weight: number | null;
  priority: number;
  order_index: number;
  note: string | null;
}

// ─── Recommendation ────────────────────────────────────────────────
export function scoreTemplate(t: TemplateLite, p: RoutinePrefs): number {
  let s = 0;
  // exact days match dominates
  if (t.days_per_week === p.desired_lifting_days) s += 100;
  else s -= Math.abs(t.days_per_week - p.desired_lifting_days) * 25;

  if (p.season_phase === "inseason") {
    if (t.days_per_week <= 3) s += 18;
    if (t.split_type.startsWith("full_body")) s += 12;
  } else {
    if (t.days_per_week >= 4) s += 12;
    if (t.split_type === "upper_lower_4") s += 4;
  }

  if (p.sport_training_load === "very_high") {
    if (t.days_per_week <= 3) s += 18;
  } else if (p.sport_training_load === "high") {
    if (t.days_per_week <= 4) s += 10;
  } else if (p.sport_training_load === "low") {
    if (t.days_per_week >= 4) s += 8;
  }
  return s;
}

export function rankTemplates(templates: TemplateLite[], p: RoutinePrefs): TemplateLite[] {
  return [...templates]
    .map((t) => ({ t, s: scoreTemplate(t, p) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

export function recommendationReason(t: TemplateLite, p: RoutinePrefs): string {
  const parts: string[] = [];
  if (t.days_per_week === p.desired_lifting_days) parts.push(`희망 일수(주 ${p.desired_lifting_days}일) 일치`);
  if (p.season_phase === "inseason" && t.days_per_week <= 3) parts.push("시즌기 회복 여유");
  if (p.season_phase === "offseason" && t.days_per_week >= 4) parts.push("비시즌 볼륨 증가");
  if (p.sport_training_load === "very_high" || p.sport_training_load === "high") {
    if (t.days_per_week <= 4) parts.push("종목훈련 부담 고려");
  }
  return parts.length ? parts.join(" · ") : "일반 추천";
}

// ─── Priority weighting ────────────────────────────────────────────
export function priorityWeight(lift: string, priorityLifts: string[]): number {
  const idx = priorityLifts.indexOf(lift);
  if (idx === 0) return 1.3;
  if (idx === 1) return 1.15;
  if (idx === 2) return 1.1;
  return 1.0;
}

// ─── Weekday mapping ───────────────────────────────────────────────
// Maps user's preferred weekdays to the template's training day_of_week slots.
// DB uses 0=Sun..6=Sat for preferred_lifting_weekdays AND day_of_week=1..7 for template_days
// (1=Mon..7=Sun based on existing /today code). We unify here.
//
// Returns: { [weekday 0..6]: template_day_of_week (1..7) | null }
export function buildWeekdayMap(
  preferredWeekdays: number[], // 0..6
  templateTrainingDows: number[], // 1..7, sorted
): Record<string, number | null> {
  const map: Record<string, number | null> = {
    "0": null, "1": null, "2": null, "3": null, "4": null, "5": null, "6": null,
  };
  // Sort preferred weekdays chronologically Mon→Sun (1..6, then 0)
  const sortedPrefs = [...preferredWeekdays].sort((a, b) => {
    const aa = a === 0 ? 7 : a;
    const bb = b === 0 ? 7 : b;
    return aa - bb;
  });
  const sortedTpl = [...templateTrainingDows].sort((a, b) => a - b);
  const n = Math.min(sortedPrefs.length, sortedTpl.length);
  for (let i = 0; i < n; i++) {
    map[String(sortedPrefs[i])] = sortedTpl[i];
  }
  return map;
}

// ─── Snapshot ──────────────────────────────────────────────────────
// Main 4 lifts: e1RM-based percent prescription is preserved, and each main
// exercise supports two execution modes (default / topset_backoff). Accessory
// lifts stay RIR-focused (percent hidden).

export type PerformanceMode = "default" | "topset_backoff";
export type SelectionScope = "today_only" | "assigned_routine";

export interface SetPrescription {
  sets: number;
  reps: number;
  intensity_percent: number | null;
  rir: number;
}

export interface SnapshotExercise {
  lift_type: string;
  exercise_name: string;
  base_sets: number;
  base_reps: number;
  base_rir: number;
  base_intensity_percent: number | null;
  is_main_lift: boolean;
  performance_mode: PerformanceMode;
  topset: SetPrescription | null;
  backoff: SetPrescription | null;
  exercise_group: string | null;
  exercise_options: string[];
  selected_exercise: string | null;
  selected_at: string | null;
  selection_scope: SelectionScope;
  e1rm_reference_lift: string | null;
  fixed_weight: number | null;
  priority: number;
  priority_weight: number;
  is_priority_lift: boolean;
  order_index: number;
  note: string | null;
  source_exercise_id: string;
}

export interface SnapshotDay {
  source_day_id: string;
  template_day_of_week: number;
  week_number: number;
  is_rest_day: boolean;
  day_title: string;
  exercises: SnapshotExercise[];
}

// Main 4 lifts that get e1RM-based recommended weight.
const MAIN4 = new Set(["squat", "bench", "deadlift", "ohp"]);

// Default prescriptions for main lifts (RIR + %)
const DEFAULT_MAIN_PCT = 75;
const DEFAULT_MAIN_RIR = 2;
const TOPSET_DEFAULT: SetPrescription = { sets: 1, reps: 3, intensity_percent: 85, rir: 1 };
const BACKOFF_DEFAULT: SetPrescription = { sets: 3, reps: 6, intensity_percent: 70, rir: 2 };

function groupKeyForLift(liftType: string): string | null {
  switch (liftType) {
    case "squat": return "squat";
    case "bench": return "horizontal_press";
    case "ohp": return "vertical_press";
    case "deadlift": return "deadlift";
    default: return null;
  }
}

// Map any candidate exercise (selected by user) back to an e1RM-tracked lift.
// Extend this map as more lifts get e1RM support.
const EXERCISE_TO_E1RM_LIFT: Record<string, string> = {
  "백스쿼트": "squat",
  "프론트스쿼트": "squat",
  "박스스쿼트": "squat",
  "포즈스쿼트": "squat",
  "벤치프레스": "bench",
  "인클라인 벤치프레스": "bench",
  "클로즈그립 벤치프레스": "bench",
  "덤벨 벤치프레스": "bench",
  "오버헤드프레스": "ohp",
  "푸쉬프레스": "ohp",
  "덤벨 숄더프레스": "ohp",
  "컨벤셔널 데드리프트": "deadlift",
  "스모 데드리프트": "deadlift",
  "루마니안 데드리프트": "deadlift",
};

const GROUP_OPTIONS: Record<string, string[]> = {
  squat: ["백스쿼트", "프론트스쿼트", "박스스쿼트", "포즈스쿼트"],
  horizontal_press: ["벤치프레스", "인클라인 벤치프레스", "클로즈그립 벤치프레스", "덤벨 벤치프레스"],
  vertical_press: ["오버헤드프레스", "푸쉬프레스", "덤벨 숄더프레스"],
  deadlift: ["컨벤셔널 데드리프트", "스모 데드리프트", "루마니안 데드리프트"],
  pull: ["바벨로우", "시티드로우", "랫풀다운", "체스트서포티드로우"],
  lower_accessory: ["런지", "불가리안 스플릿 스쿼트", "레그프레스"],
  core: ["플랭크", "행잉 레그레이즈", "케이블 크런치", "팔로프프레스"],
};

/** Round to gym-friendly plate increments. */
export function roundGymWeight(w: number): number {
  if (!Number.isFinite(w) || w <= 0) return 0;
  return w >= 60 ? Math.round(w / 2.5) * 2.5 : Math.round(w);
}

/** Compute recommended weight from e1RM + intensity percent. */
export function recommendedWeight(
  e1rm: number | null | undefined,
  intensityPercent: number | null | undefined,
): number | null {
  if (!e1rm || e1rm <= 0) return null;
  if (!intensityPercent || intensityPercent <= 0) return null;
  return roundGymWeight(e1rm * (intensityPercent / 100));
}

/** Resolve e1RM-tracked lift for a selected exercise. */
export function resolveE1rmLift(
  selectedExercise: string | null,
  fallbackLift: string | null,
): string | null {
  if (selectedExercise && EXERCISE_TO_E1RM_LIFT[selectedExercise]) {
    return EXERCISE_TO_E1RM_LIFT[selectedExercise];
  }
  if (fallbackLift && MAIN4.has(fallbackLift)) return fallbackLift;
  return null;
}

export function buildSnapshot(
  days: TemplateDayLite[],
  exercises: TemplateExerciseLite[],
  prefs: RoutinePrefs,
): SnapshotDay[] {
  return days.map((d) => {
    const exs = exercises
      .filter((e) => e.template_day_id === d.id)
      .sort((a, b) => a.order_index - b.order_index)
      .map<SnapshotExercise>((e) => {
        const pw = priorityWeight(e.lift_type, prefs.priority_lifts);
        const isMain = MAIN4.has(e.lift_type);
        const groupKey = groupKeyForLift(e.lift_type);

        // Main lifts: keep percent (template value if present, else default).
        // Accessories: percent hidden.
        const basePct = isMain
          ? (e.base_intensity_percent ?? DEFAULT_MAIN_PCT)
          : null;
        const baseRir = isMain ? DEFAULT_MAIN_RIR : 2;

        return {
          lift_type: e.lift_type,
          exercise_name: e.exercise_name,
          base_sets: e.base_sets,
          base_reps: e.base_reps,
          base_rir: baseRir,
          base_intensity_percent: basePct,
          is_main_lift: isMain,
          performance_mode: "default",
          topset: isMain ? { ...TOPSET_DEFAULT } : null,
          backoff: isMain ? { ...BACKOFF_DEFAULT } : null,
          exercise_group: groupKey,
          exercise_options: groupKey ? GROUP_OPTIONS[groupKey] ?? [] : [],
          selected_exercise: null,
          selected_at: null,
          selection_scope: "assigned_routine",
          e1rm_reference_lift: isMain ? e.lift_type : null,
          fixed_weight: e.fixed_weight,
          priority: e.priority,
          priority_weight: pw,
          is_priority_lift: pw > 1.0,
          order_index: e.order_index,
          note: e.note,
          source_exercise_id: e.id,
        };
      });
    return {
      source_day_id: d.id,
      template_day_of_week: d.day_of_week,
      week_number: d.week_number,
      is_rest_day: d.is_rest_day,
      day_title: d.day_title,
      exercises: exs,
    };
  });
}
