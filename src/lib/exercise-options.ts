// Exercise selection candidates (MVP — code-side seed).
// Each main/accessory slot has a "group" of candidate exercises the athlete can pick from.
// Future: persist `selected_exercise` + `selection_scope` per-session/per-routine. For now,
// selection is stored as `exercise_name` override on the workout_log row (today_only scope).

export type ExerciseGroupKey =
  | "squat"
  | "horizontal_press"
  | "vertical_press"
  | "pull"
  | "lower_accessory"
  | "core";

export interface ExerciseGroup {
  key: ExerciseGroupKey;
  label: string;
  options: string[]; // first = canonical/default
}

export const EXERCISE_GROUPS: Record<ExerciseGroupKey, ExerciseGroup> = {
  squat: {
    key: "squat",
    label: "스쿼트 계열",
    options: ["백스쿼트", "프론트스쿼트", "박스스쿼트", "포즈스쿼트"],
  },
  horizontal_press: {
    key: "horizontal_press",
    label: "수평 프레스 계열",
    options: ["벤치프레스", "인클라인 벤치프레스", "클로즈그립 벤치프레스", "덤벨 벤치프레스"],
  },
  vertical_press: {
    key: "vertical_press",
    label: "수직 프레스 계열",
    options: ["오버헤드프레스", "푸쉬프레스", "덤벨 숄더프레스"],
  },
  pull: {
    key: "pull",
    label: "당기기 계열",
    options: ["바벨로우", "시티드로우", "랫풀다운", "체스트서포티드로우"],
  },
  lower_accessory: {
    key: "lower_accessory",
    label: "하체 보조 계열",
    options: ["런지", "불가리안 스플릿 스쿼트", "레그프레스"],
  },
  core: {
    key: "core",
    label: "코어 계열",
    options: ["플랭크", "행잉 레그레이즈", "케이블 크런치", "팔로프프레스"],
  },
};

// Resolve which group a given lift_type / exercise name belongs to.
// Returns null when the exercise is fixed (no selection allowed) — e.g. deadlift, power clean.
export function groupForExercise(liftType: string | null | undefined, name: string | null | undefined): ExerciseGroup | null {
  const lt = (liftType ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();

  if (lt === "squat" || /스쿼트|squat/.test(n)) return EXERCISE_GROUPS.squat;
  if (lt === "bench" || /벤치|bench/.test(n)) return EXERCISE_GROUPS.horizontal_press;
  if (lt === "ohp" || /오버헤드|프레스|press/.test(n)) {
    if (/벤치|bench/.test(n)) return EXERCISE_GROUPS.horizontal_press;
    return EXERCISE_GROUPS.vertical_press;
  }
  if (/로우|풀다운|row|pull-?down/.test(n)) return EXERCISE_GROUPS.pull;
  if (/런지|스플릿|레그프레스|lunge|leg press/.test(n)) return EXERCISE_GROUPS.lower_accessory;
  if (/플랭크|크런치|레그레이즈|팔로프|plank|crunch|raise/.test(n)) return EXERCISE_GROUPS.core;

  // Fixed slots: deadlift, power clean, pullup, dips → no selection
  return null;
}
