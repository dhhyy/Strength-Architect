// Main-lift card schema for /today workout_logs.set_logs JSON.
// Backwards compatible: accessories keep using SetEntry[].
// Main lifts use { schema: "main_v1", ... }.
// Athlete UI shows: goal, rep range, RIR, recommended start weight — NEVER %.

import type { MainGoal } from "./goal-ranges";
import {
  recommendedStartWeight,
  recommendedTopsetWeight,
  recommendedBackoffWeight,
} from "./goal-ranges";

export const MAIN4 = ["squat", "bench", "deadlift", "ohp"] as const;
export type MainLift = (typeof MAIN4)[number];

export function isMainLift(liftType: string | null | undefined): liftType is MainLift {
  return !!liftType && (MAIN4 as readonly string[]).includes(liftType);
}

/** Two athlete-facing modes. `rir_working` legacy key = "fixed sets". */
export type ExecutionMode = "rir_working" | "top_backoff";

export interface WorkingSet {
  weight: number;
  reps: number;
  rir: number | null;
  completed: boolean;
}

export interface PlannedRir {
  sets: number;
  reps_low: number;
  reps_high: number;
  target_rir: [number, number];
  amrap_enabled?: boolean;
}

export interface PlannedTopset {
  sets: number;
  reps_low: number;
  reps_high: number;
  target_rir: number;
  actual_weight: number | null;
  input_weight?: number | null;
  suggested_rep_min?: number | null;
  suggested_rep_max?: number | null;
  actual_reps?: number | null;
  actual_rir?: number | null;
}

export interface PlannedBackoff {
  sets: number;
  reps_low: number;
  reps_high: number;
  target_rir: number;
  actual_weight: number | null;
  recommended_weight_min?: number | null;
  recommended_weight_max?: number | null;
  recommended_rep_min?: number | null;
  recommended_rep_max?: number | null;
  target_rir_min?: number | null;
  target_rir_max?: number | null;
  actual_reps?: number | null;
  actual_rir?: number | null;
}

export interface MainLogV1 {
  schema: "main_v1";
  execution_mode: ExecutionMode;
  goal: MainGoal;
  recommended_start_weight: number | null;
  recommended_topset_weight: number | null;
  recommended_backoff_weight: number | null;
  planned: PlannedRir;
  topset: PlannedTopset;
  backoff: PlannedBackoff;
  e1rm_used: number;
  actual_selected_weight: number | null;
  working_sets: WorkingSet[];
  estimated_e1rm_after_session?: number | null;
}

export const DEFAULT_TARGET_RIR: [number, number] = [2, 3];

export interface BuildArgs {
  liftType: string;
  e1rm: number;
  plannedSets: number;
  plannedReps: number; // legacy single rep — used only if range missing
  goal: MainGoal;
  repLow: number;
  repHigh: number;
  condition?: "ready" | "normal" | "low" | null;
}

export function buildMainLog(args: BuildArgs): MainLogV1 {
  const mode: ExecutionMode = args.condition === "ready" ? "top_backoff" : "rir_working";
  const start = recommendedStartWeight(args.e1rm, args.goal, args.repLow, args.repHigh);
  const top = recommendedTopsetWeight(args.e1rm, args.goal, args.repLow);
  const back = recommendedBackoffWeight(top);
  return {
    schema: "main_v1",
    execution_mode: mode,
    goal: args.goal,
    recommended_start_weight: start,
    recommended_topset_weight: top,
    recommended_backoff_weight: back,
    planned: {
      sets: args.plannedSets || 4,
      reps_low: args.repLow,
      reps_high: args.repHigh,
      target_rir: DEFAULT_TARGET_RIR,
    },
    topset: {
      sets: 1,
      reps_low: args.repLow,
      reps_high: args.repHigh,
      target_rir: 1,
      actual_weight: null,
    },
    backoff: {
      sets: 2,
      reps_low: args.repLow,
      reps_high: args.repHigh,
      target_rir: 2,
      actual_weight: null,
    },
    e1rm_used: Math.max(0, args.e1rm || 0),
    actual_selected_weight: null,
    working_sets: [],
  };
}

/** Read whatever shape DB has and return a MainLogV1, migrating legacy values. */
export function readMainLog(raw: unknown, args: BuildArgs): MainLogV1 {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, any>;
    if (r.schema === "main_v1") {
      // Migrate legacy "basic" execution_mode.
      const exec: ExecutionMode = r.execution_mode === "top_backoff" ? "top_backoff" : "rir_working";
      const fresh = buildMainLog(args);
      return {
        ...fresh,
        ...r,
        execution_mode: exec,
        // ensure rep_low/high present even on old payloads
        planned: {
          sets: r.planned?.sets ?? fresh.planned.sets,
          reps_low: r.planned?.reps_low ?? r.planned?.reps ?? fresh.planned.reps_low,
          reps_high: r.planned?.reps_high ?? r.planned?.reps ?? fresh.planned.reps_high,
          target_rir: r.planned?.target_rir ?? fresh.planned.target_rir,
        },
        topset: { ...fresh.topset, ...(r.topset ?? {}) },
        backoff: { ...fresh.backoff, ...(r.backoff ?? {}) },
        goal: r.goal ?? args.goal,
        recommended_start_weight: r.recommended_start_weight ?? fresh.recommended_start_weight,
        recommended_topset_weight: r.recommended_topset_weight ?? fresh.recommended_topset_weight,
        recommended_backoff_weight: r.recommended_backoff_weight ?? fresh.recommended_backoff_weight,
        working_sets: Array.isArray(r.working_sets) ? r.working_sets : [],
      } as MainLogV1;
    }
  }
  const fresh = buildMainLog(args);
  if (Array.isArray(raw)) {
    fresh.working_sets = (raw as Array<{ weight?: number; reps?: number; completed?: boolean }>).map(
      (s) => ({
        weight: Number(s?.weight ?? 0),
        reps: Number(s?.reps ?? 0),
        rir: null,
        completed: !!s?.completed,
      }),
    );
  }
  return fresh;
}
