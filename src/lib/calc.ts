import type { LiftType } from "./types";

export function calculateE1RM(
  weight: number,
  reps: number,
  liftType: LiftType,
  bodyweight: number = 0,
): number {
  if (reps < 1 || weight < 0) return 0;
  if (liftType === "pullup" || liftType === "dips") {
    const total = (bodyweight + weight) * (1 + reps / 30);
    return Math.round((total - bodyweight) * 10) / 10;
  }
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export const SPORT_MULT: Record<number, number> = { 1: 1.15, 2: 1.05, 3: 1.0, 4: 0.75, 5: 0.5 };
export const FATIGUE_MULT: Record<number, { weight: number; sets: number; reps: number }> = {
  1: { weight: 1.05, sets: 1.0, reps: 1.0 },
  2: { weight: 1.0, sets: 1.0, reps: 1.0 },
  3: { weight: 1.0, sets: 1.0, reps: 1.0 },
  4: { weight: 0.9, sets: 0.8, reps: 1.0 },
  5: { weight: 0.75, sets: 0.6, reps: 0.8 },
};

function roundWeight(w: number): number {
  if (w <= 0) return 0;
  return w >= 60 ? Math.round(w / 2.5) * 2.5 : Math.round(w);
}

function fallbackWeightedExtra(liftType: string, intensityPercent: number | null): number {
  if (liftType !== "pullup" && liftType !== "dips") return 0;
  const pct = intensityPercent ?? 0;
  if (liftType === "pullup") return pct >= 80 ? 10 : pct >= 70 ? 8 : pct >= 60 ? 7 : 5;
  return pct >= 80 ? 12 : pct >= 70 ? 10 : pct >= 60 ? 8 : 6;
}

// ========== TAPERING ==========
export type CompetitionImportance = "A" | "B" | "C";

export interface TaperResult {
  weightMult: number;
  setMult: number;
  label: string;
  banner: string;
  restRecommended: boolean;
  isCompDay: boolean;
}

/** days = competition_date - today (음수면 D+) */
export function taperFromDayDiff(
  daysUntil: number,
  importance: CompetitionImportance,
  compName: string,
): TaperResult | null {
  // C: 적용 안함
  if (importance === "C") return null;
  // B: D-7 부터만 적용
  const isB = importance === "B";

  if (daysUntil === 0) {
    return {
      weightMult: 0,
      setMult: 0,
      label: "시합일",
      banner: `🏆 오늘 시합! ${compName} 화이팅!`,
      restRecommended: true,
      isCompDay: true,
    };
  }
  if (daysUntil === -1 || daysUntil === -2 || daysUntil === -3) {
    return {
      weightMult: 0.7,
      setMult: 0.6,
      label: "회복 모드",
      banner: `🛌 시합 후 회복 ${Math.abs(daysUntil)}일차 (${compName})`,
      restRecommended: false,
      isCompDay: false,
    };
  }
  if (daysUntil < -3) return null;

  if (daysUntil === 1) {
    return {
      weightMult: 0,
      setMult: 0,
      label: "휴식",
      banner: `🏆 시합 D-1 (${compName}) - 컨디션 조절, 휴식 권장`,
      restRecommended: true,
      isCompDay: false,
    };
  }
  if (daysUntil >= 2 && daysUntil <= 3) {
    return {
      weightMult: 0.7,
      setMult: 0.5,
      label: "강도만 유지",
      banner: `🏆 시합 D-${daysUntil} (${compName}) - 강도만 유지, 볼륨↓`,
      restRecommended: false,
      isCompDay: false,
    };
  }
  if (daysUntil >= 4 && daysUntil <= 7) {
    return {
      weightMult: 0.85,
      setMult: 0.7,
      label: "본격 테이퍼",
      banner: `🏆 시합 D-${daysUntil} (${compName}) - 본격 테이퍼링 중`,
      restRecommended: false,
      isCompDay: false,
    };
  }
  if (!isB && daysUntil >= 8 && daysUntil <= 14) {
    return {
      weightMult: 0.95,
      setMult: 0.9,
      label: "가벼운 감량",
      banner: `🏆 시합 D-${daysUntil} (${compName}) - 가벼운 감량 시작`,
      restRecommended: false,
      isCompDay: false,
    };
  }
  return null;
}

export function pickActiveTaper(
  competitions: Array<{ competition_date: string; competition_name: string; importance: CompetitionImportance }>,
  today: Date = new Date(),
): TaperResult | null {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  let best: TaperResult | null = null;
  for (const c of competitions) {
    const d = new Date(c.competition_date);
    const diff = Math.round((d.getTime() - t0) / 86400000);
    const t = taperFromDayDiff(diff, c.importance, c.competition_name);
    if (!t) continue;
    // pick lowest weightMult (가장 강한 테이퍼)
    if (!best || t.weightMult < best.weightMult) best = t;
  }
  return best;
}

export interface TemplateExerciseLike {
  id: string;
  exercise_name: string;
  lift_type: string;
  base_sets: number;
  base_reps: number;
  base_intensity_percent: number | null;
  fixed_weight: number | null;
  priority: number;
  note: string | null;
}

export interface PrescribedExercise {
  exercise_id: string;
  name: string;
  lift_type: string;
  sets: number;
  reps: number;
  weight: number;
  intensity_percent: number | null;
  priority: number;
  note: string | null;
  skipped: boolean;
  skipReason?: string;
  e1rm_used?: number;
}

export function calculateTodayExercise(
  exercise: TemplateExerciseLike,
  athleteE1RMs: Partial<Record<string, number>>,
  sportIntensity: number,
  fatigueLevel: number,
  taper: TaperResult | null = null,
): PrescribedExercise {
  const sportMult = SPORT_MULT[sportIntensity] ?? 1;
  const fatigueMult = FATIGUE_MULT[fatigueLevel] ?? FATIGUE_MULT[3];
  const taperWMult = taper ? taper.weightMult : 1;
  const taperSMult = taper ? taper.setMult : 1;
  const totalVolumeMult = sportMult * fatigueMult.sets * taperSMult;

  const base = {
    exercise_id: exercise.id,
    name: exercise.exercise_name,
    lift_type: exercise.lift_type,
    priority: exercise.priority,
    intensity_percent: exercise.base_intensity_percent,
    note: exercise.note,
  };

  if (taper?.restRecommended) {
    return { ...base, sets: 0, reps: 0, weight: 0, skipped: true, skipReason: taper.label };
  }
  if (totalVolumeMult < 0.3 && exercise.priority < 3) {
    return { ...base, sets: 0, reps: 0, weight: 0, skipped: true, skipReason: "휴식 권장" };
  }
  if (totalVolumeMult < 0.5 && exercise.priority < 3) {
    return { ...base, sets: 0, reps: 0, weight: 0, skipped: true, skipReason: "오늘은 필수 운동만" };
  }
  if (totalVolumeMult < 0.7 && exercise.priority === 1) {
    return { ...base, sets: 0, reps: 0, weight: 0, skipped: true, skipReason: "총량 조절로 제외" };
  }

  let weight = 0;
  let e1rm_used: number | undefined;
  if (exercise.lift_type === "pullup" || exercise.lift_type === "dips") {
    const baseExtra = exercise.fixed_weight && exercise.fixed_weight > 0
      ? Number(exercise.fixed_weight)
      : fallbackWeightedExtra(exercise.lift_type, exercise.base_intensity_percent);
    e1rm_used = Math.max(baseExtra, 1);
    weight = roundWeight(baseExtra * fatigueMult.weight * taperWMult);
  } else if (exercise.lift_type !== "accessory") {
    const e1rm = athleteE1RMs[exercise.lift_type] || 0;
    e1rm_used = e1rm;
    weight = e1rm * ((exercise.base_intensity_percent ?? 0) / 100) * fatigueMult.weight * taperWMult;
    weight = roundWeight(weight);
  } else if (exercise.fixed_weight) {
    weight = roundWeight(exercise.fixed_weight * fatigueMult.weight * taperWMult);
  }

  return {
    ...base,
    sets: Math.max(1, Math.round(exercise.base_sets * sportMult * fatigueMult.sets * taperSMult)),
    reps: Math.max(1, Math.round(exercise.base_reps * fatigueMult.reps)),
    weight,
    skipped: false,
    e1rm_used,
  };
}

export function isRecoveryDay(sportIntensity: number, fatigueLevel: number): boolean {
  return sportIntensity === 5 && fatigueLevel === 5;
}

export function volumePercent(sportIntensity: number, fatigueLevel: number, taper: TaperResult | null = null): number {
  const t = taper ? taper.setMult : 1;
  return Math.round(SPORT_MULT[sportIntensity] * FATIGUE_MULT[fatigueLevel].sets * t * 100);
}

// ========== NEURAL BUDGET ==========
const SPORT_LOAD: Record<number, number> = { 1: 5, 2: 10, 3: 15, 4: 25, 5: 35 };
function repsFactor(reps: number): number {
  if (reps <= 3) return 1.5;
  if (reps <= 6) return 1.2;
  if (reps <= 10) return 1.0;
  return 0.7;
}
export interface NBSet { reps: number; weight: number }
export interface NBExercise { lift_type: string; sets: NBSet[]; e1rm?: number }
export function calcWeightScore(exercises: NBExercise[]): number {
  let total = 0;
  for (const ex of exercises) {
    const e1rm = ex.e1rm && ex.e1rm > 0 ? ex.e1rm : 0;
    for (const s of ex.sets) {
      if (!s.reps || s.weight === undefined || s.weight === null) continue;
      const ratio = e1rm > 0 ? s.weight / e1rm : 0.5;
      total += ratio * repsFactor(s.reps);
    }
  }
  return Math.round(total * 10) / 10;
}
export function calcSportScore(sportIntensity: number): number {
  return SPORT_LOAD[sportIntensity] ?? 0;
}
export interface NBBucket { label: string; color: string; bar: string }
export function nbBucket(total: number): NBBucket {
  if (total <= 30) return { label: "여유", color: "text-emerald-700", bar: "bg-emerald-500" };
  if (total <= 50) return { label: "보통", color: "text-blue-700", bar: "bg-blue-500" };
  if (total <= 70) return { label: "주의", color: "text-orange-700", bar: "bg-orange-500" };
  return { label: "높음", color: "text-red-700", bar: "bg-red-500" };
}
