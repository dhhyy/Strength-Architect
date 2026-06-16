// Routine carryover helpers backed by daily_routines.planned_date / executed_date.
// Model (현실적 단순 구조):
// - workout_logs.date  = 실제 수행(또는 수행 예정) 날짜 (source of truth for today 화면)
// - daily_routines     = 이월 원장(ledger): planned_date(원래 예정일) / executed_date(이동된 날짜)
//                        adjusted_data JSON에 어떤 운동이 이월됐는지 기록
//
// 이월 시:
//   1) workout_logs.date 를 새 날짜로 UPDATE
//   2) daily_routines 에 ledger row INSERT
// 중복 생성을 피하기 위해 동일 (planned_date, executed_date) 조합에만 한 row.

import { supabase } from "@/integrations/supabase/client";

export interface CarryoverLedger {
  id: string;
  athlete_id: string;
  template_day_id: string | null;
  date: string;
  planned_date: string | null;
  executed_date: string | null;
  is_modified: boolean;
  adjusted_data: {
    type?: "carryover_full_day" | "carryover_exercise";
    workout_log_id?: string;
    template_exercise_id?: string | null;
    exercise_name?: string;
  } | null;
}

export function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 오늘 미완료 루틴 전체를 다른 날짜로 이월 */
export async function carryOverDay(
  athleteId: string,
  fromDate: string,
  toDate: string,
  templateDayId: string | null = null,
): Promise<{ moved: number }> {
  if (fromDate === toDate) return { moved: 0 };

  // 미완료 로그만 이동 (이미 완료된 운동은 그대로 둠)
  const { data: toMove, error: selErr } = await supabase
    .from("workout_logs")
    .select("id, exercise_name")
    .eq("athlete_id", athleteId)
    .eq("date", fromDate)
    .eq("completed", false);
  if (selErr) throw selErr;

  if (toMove && toMove.length > 0) {
    const ids = toMove.map((l) => l.id);
    const { error: upErr } = await supabase
      .from("workout_logs")
      .update({ date: toDate })
      .in("id", ids);
    if (upErr) throw upErr;
  }

  // 원장 기록 (upsert-like: 동일 조합 있으면 갱신)
  await supabase.from("daily_routines").insert({
    athlete_id: athleteId,
    template_day_id: templateDayId,
    date: toDate,
    planned_date: fromDate,
    executed_date: toDate,
    is_modified: true,
    adjusted_data: { type: "carryover_full_day" },
  });

  return { moved: toMove?.length ?? 0 };
}

/** 특정 운동 한 개만 이월 */
export async function carryOverExercise(
  workoutLogId: string,
  athleteId: string,
  fromDate: string,
  toDate: string,
  exerciseName: string,
  templateExerciseId: string | null = null,
): Promise<void> {
  if (fromDate === toDate) return;

  const { error: upErr } = await supabase
    .from("workout_logs")
    .update({ date: toDate })
    .eq("id", workoutLogId);
  if (upErr) throw upErr;

  const { data: existing } = await supabase
    .from("daily_routines")
    .select("id, adjusted_data")
    .eq("athlete_id", athleteId)
    .eq("date", toDate)
    .maybeSingle();

  const entry = {
    type: "carryover_exercise" as const,
    workout_log_id: workoutLogId,
    template_exercise_id: templateExerciseId,
    exercise_name: exerciseName,
    planned_date: fromDate,
    executed_date: toDate,
  };

  if (existing?.id) {
    const prev = Array.isArray(existing.adjusted_data)
      ? existing.adjusted_data
      : existing.adjusted_data
        ? [existing.adjusted_data]
        : [];
    const { error: ledgerErr } = await supabase
      .from("daily_routines")
      .update({
        planned_date: fromDate,
        executed_date: toDate,
        is_modified: true,
        adjusted_data: [...prev, entry],
      })
      .eq("id", existing.id);
    if (ledgerErr) throw ledgerErr;
    return;
  }

  await supabase.from("daily_routines").insert({
    athlete_id: athleteId,
    date: toDate,
    planned_date: fromDate,
    executed_date: toDate,
    is_modified: true,
    adjusted_data: entry,
  });
}

/** 해당 날짜로 이월되어 들어온 ledger 목록 */
export async function getCarriedInLedger(
  athleteId: string,
  date: string,
): Promise<CarryoverLedger[]> {
  const { data } = await supabase
    .from("daily_routines")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("executed_date", date)
    .neq("planned_date", date);
  return (data ?? []) as CarryoverLedger[];
}

/** 해당 날짜에서 다른 날짜로 이월되어 나간 ledger 목록 */
export async function getCarriedOutLedger(
  athleteId: string,
  date: string,
): Promise<CarryoverLedger[]> {
  const { data } = await supabase
    .from("daily_routines")
    .select("*")
    .eq("athlete_id", athleteId)
    .eq("planned_date", date)
    .neq("executed_date", date);
  return (data ?? []) as CarryoverLedger[];
}

/** workout_log id 집합 → 이월되어 들어온 항목 여부 맵 */
export function buildCarriedInMap(
  ledger: CarryoverLedger[],
): { logIds: Set<string>; templateExerciseIds: Set<string>; fullDayFromDates: string[] } {
  const logIds = new Set<string>();
  const templateExerciseIds = new Set<string>();
  const fullDayFromDates: string[] = [];
  for (const row of ledger) {
    const entries = Array.isArray(row.adjusted_data) ? row.adjusted_data : row.adjusted_data ? [row.adjusted_data] : [];
    for (const entry of entries) {
      if (entry.type === "carryover_exercise" && entry.workout_log_id) {
        logIds.add(entry.workout_log_id);
        if (entry.template_exercise_id) templateExerciseIds.add(entry.template_exercise_id);
      } else if (entry.type === "carryover_full_day" && row.planned_date) {
        fullDayFromDates.push(row.planned_date);
      }
    }
  }
  return { logIds, templateExerciseIds, fullDayFromDates };
}
