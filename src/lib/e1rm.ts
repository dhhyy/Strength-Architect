// Gentle e1RM estimation and recompute.
// e1RM is a REFERENCE for recommended start weight, never the truth.

import { supabase } from "@/integrations/supabase/client";

/** Epley with RIR adjustment: effective reps = reps + rir. */
export function estimateE1rm(weight: number, reps: number, rir: number | null): number | null {
  if (!weight || weight <= 0 || !reps || reps <= 0) return null;
  const r = Math.max(0, reps + (rir ?? 0));
  // Epley: 1RM ≈ w × (1 + r/30)
  return Math.round(weight * (1 + r / 30) * 10) / 10;
}

/** Blend prior estimate with new observation. Weighted toward prior (60/40). */
export function blendE1rm(prev: number | null | undefined, next: number): number {
  if (!prev || prev <= 0) return Math.round(next * 10) / 10;
  return Math.round((prev * 0.6 + next * 0.4) * 10) / 10;
}

/**
 * Update athlete_lifts.e1rm for a lift based on a completed set.
 * Safe: no-op if values are missing. Never lowers e1RM by more than 5kg in one step.
 */
export async function recomputeAndStoreE1rm(args: {
  athleteId: string;
  liftType: string;
  weight: number;
  reps: number;
  rir: number | null;
  date: string;
}): Promise<number | null> {
  const est = estimateE1rm(args.weight, args.reps, args.rir);
  if (est == null) return null;

  const { data: cur } = await supabase
    .from("athlete_lifts")
    .select("id, e1rm")
    .eq("athlete_id", args.athleteId)
    .eq("lift_type", args.liftType as any)
    .eq("is_current", true)
    .maybeSingle();

  const prev = cur?.e1rm ? Number(cur.e1rm) : null;
  let blended = blendE1rm(prev, est);
  if (prev && blended < prev - 5) blended = prev - 5; // cap downward swings

  if (cur?.id) {
    await supabase
      .from("athlete_lifts")
      .update({ e1rm: blended, recorded_date: args.date } as any)
      .eq("id", cur.id);
  } else {
    await supabase.from("athlete_lifts").insert({
      athlete_id: args.athleteId,
      lift_type: args.liftType as any,
      weight_lifted: args.weight,
      reps: args.reps,
      e1rm: blended,
      recorded_date: args.date,
      is_current: true,
    } as any);
  }
  return blended;
}
