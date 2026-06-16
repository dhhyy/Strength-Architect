// Goal & rep-range options for main lifts.
// Percentages are INTERNAL ONLY — never display them in the athlete UI.

export type MainGoal = "hypertrophy" | "strength";

export interface RepRangeOption {
  low: number;
  high: number;
  /** Internal start-weight % of e1RM. Used to compute recommended start weight only. */
  startPercent: number;
  label: string;
}

export const HYPERTROPHY_RANGES: RepRangeOption[] = [
  { low: 6,  high: 8,  startPercent: 78, label: "6~8회" },
  { low: 8,  high: 10, startPercent: 73, label: "8~10회" },
  { low: 10, high: 12, startPercent: 68, label: "10~12회" },
];

export const STRENGTH_RANGES: RepRangeOption[] = [
  { low: 1, high: 3, startPercent: 90, label: "1~3회" },
  { low: 3, high: 5, startPercent: 85, label: "3~5회" },
  { low: 4, high: 6, startPercent: 82, label: "4~6회" },
];

export function rangesForGoal(goal: MainGoal): RepRangeOption[] {
  return goal === "strength" ? STRENGTH_RANGES : HYPERTROPHY_RANGES;
}

export function defaultRangeFor(goal: MainGoal): RepRangeOption {
  return rangesForGoal(goal)[1];
}

/** Look up the % for a given (low, high) within a goal. Falls back to mid bucket. */
export function lookupStartPercent(goal: MainGoal, low: number, high: number): number {
  const opts = rangesForGoal(goal);
  const hit = opts.find((o) => o.low === low && o.high === high);
  return hit ? hit.startPercent : opts[1].startPercent;
}

/** Round to gym-friendly plate increments. */
export function roundGymWeight(w: number): number {
  if (!Number.isFinite(w) || w <= 0) return 0;
  return w >= 60 ? Math.round(w / 2.5) * 2.5 : Math.round(w);
}

/** Recommended START weight from e1RM (returns null when unknown). */
export function recommendedStartWeight(
  e1rm: number | null | undefined,
  goal: MainGoal,
  low: number,
  high: number,
): number | null {
  if (!e1rm || e1rm <= 0) return null;
  const pct = lookupStartPercent(goal, low, high);
  return roundGymWeight(e1rm * (pct / 100));
}

/** Recommended topset start: top of the range / strength = higher %. */
export function recommendedTopsetWeight(
  e1rm: number | null | undefined,
  goal: MainGoal,
  low: number,
): number | null {
  if (!e1rm || e1rm <= 0) return null;
  // For topset, use the % associated with the LOW (heaviest) end of the chosen range.
  const opts = rangesForGoal(goal);
  const hit = opts.find((o) => o.low === low) ?? opts[0];
  return roundGymWeight(e1rm * (hit.startPercent / 100));
}

/** Recommended backoff start: ~10% lighter than topset start. */
export function recommendedBackoffWeight(topset: number | null): number | null {
  if (!topset || topset <= 0) return null;
  return roundGymWeight(topset * 0.9);
}
