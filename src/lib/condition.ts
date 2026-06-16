// Today's training-readiness condition.
// Drives the RECOMMENDED execution mode for main lifts.
// The app never forces a mode — athletes can override in the settings sheet.

import { supabase } from "@/integrations/supabase/client";

export type Condition = "ready" | "normal" | "low";

export const CONDITION_LABELS: Record<Condition, string> = {
  ready: "준비됨",
  normal: "보통",
  low: "별로",
};

export const CONDITION_EMOJI: Record<Condition, string> = {
  ready: "🔥",
  normal: "🙂",
  low: "🥱",
};

export const CONDITION_DESC: Record<Condition, string> = {
  ready: "탑세트 + 백오프 추천",
  normal: "루틴 기본안 유지",
  low: "RIR 기준 워킹세트 추천",
};

export type ExecMode = "top_backoff" | "rir_working";

export function recommendedExecMode(c: Condition | null | undefined): ExecMode {
  if (c === "ready") return "top_backoff";
  if (c === "low") return "rir_working";
  // normal or unset → keep RIR working as the safer default
  return "rir_working";
}

export async function readTodayCondition(
  athleteId: string,
  date: string,
): Promise<Condition | null> {
  const { data } = await supabase
    .from("daily_checkins")
    .select("condition")
    .eq("athlete_id", athleteId)
    .eq("date", date)
    .maybeSingle();
  const c = (data as any)?.condition as string | null | undefined;
  if (c === "ready" || c === "normal" || c === "low") return c;
  return null;
}

export async function writeTodayCondition(
  athleteId: string,
  date: string,
  condition: Condition,
): Promise<void> {
  await supabase
    .from("daily_checkins")
    .upsert(
      { athlete_id: athleteId, date, condition } as any,
      { onConflict: "athlete_id,date" },
    );
}
