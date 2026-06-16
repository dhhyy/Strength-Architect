// Performance mode scaffold for main-lift cards.
// Future: 'topset_backoff' will add automatic top set / back-off calculation,
// fatigue-budget integration, and split history analysis. This file only
// reserves the shape so /today main cards don't break when the toggle ships.

export type PerformanceMode = "standard" | "topset_backoff";

// Lifts eligible for top-set/back-off in a future turn.
// Deadlift is conditional — included so UI can opt-in per athlete later.
export const TOPSET_BACKOFF_ELIGIBLE_LIFTS: ReadonlyArray<string> = [
  "back_squat",
  "bench_press",
  "overhead_press",
  "pullup",
  "dips",
  "deadlift", // conditional
];

// Explicitly excluded (power / jump sessions).
export const TOPSET_BACKOFF_EXCLUDED_LIFTS: ReadonlyArray<string> = [
  "power_clean",
  "clean",
  "snatch",
  "jump",
  "box_jump",
];

export function isTopsetBackoffEligible(liftType: string | null | undefined): boolean {
  if (!liftType) return false;
  if (TOPSET_BACKOFF_EXCLUDED_LIFTS.includes(liftType)) return false;
  return TOPSET_BACKOFF_ELIGIBLE_LIFTS.includes(liftType);
}

// Default mode resolver — currently always 'standard'. Future PR will read
// from assigned_routine prefs or per-exercise override.
export function resolvePerformanceMode(_liftType: string): PerformanceMode {
  return "standard";
}
