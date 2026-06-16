// Rule-based recommendation for top_set / backoff ranges.
// Uses Epley + RIR reversed estimate to suggest rep ranges and weights.
// Output is always a RANGE, never a forced answer.

export interface RepRangeSuggestion {
  min: number;
  max: number;
}

/**
 * Estimate predicted reps for a given top-set weight.
 * Epley: e1rm ≈ w * (1 + r/30) where r = actual reps + rir.
 * Reverse: r ≈ ((e1rm/w) - 1) * 30; pred_reps = r - target_rir.
 * Returns a ±1 reps range, clamped to [1, 30].
 */
export function predictTopSetReps(
  inputWeight: number,
  e1rm: number | null | undefined,
  targetRir: number = 1,
): RepRangeSuggestion | null {
  if (!inputWeight || inputWeight <= 0) return null;
  if (!e1rm || e1rm <= 0) return null;
  const ratio = e1rm / inputWeight;
  if (ratio <= 1) return { min: 1, max: 2 }; // weight ≥ e1rm
  const effective = (ratio - 1) * 30;
  const center = Math.round(effective - targetRir);
  const clamped = Math.max(1, Math.min(30, center));
  return { min: Math.max(1, clamped - 1), max: Math.min(30, clamped + 1) };
}

/**
 * Recommend backoff weight RANGE (85%–90% of top-set actual weight).
 * Rounded to gym-friendly increments.
 */
export function recommendBackoffWeightRange(
  topActualWeight: number,
): { min: number; max: number } | null {
  if (!topActualWeight || topActualWeight <= 0) return null;
  const round = (w: number) => (w >= 60 ? Math.round(w / 2.5) * 2.5 : Math.round(w));
  return {
    min: round(topActualWeight * 0.85),
    max: round(topActualWeight * 0.9),
  };
}

/**
 * Recommend backoff rep RANGE — about +2~+4 above the top-set rep target,
 * aiming for RIR 3~4 (extra room in the tank).
 */
export function recommendBackoffRepRange(
  topRepLow: number,
  topRepHigh: number,
): RepRangeSuggestion {
  return {
    min: Math.max(1, topRepLow + 2),
    max: Math.max(topRepLow + 3, topRepHigh + 4),
  };
}

/** Backoff target RIR — RIR 3~4. */
export const BACKOFF_TARGET_RIR = { min: 3, max: 4 } as const;
