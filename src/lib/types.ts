export const LIFT_TYPES = [
  "squat",
  "deadlift",
  "bench",
  "ohp",
  "power_clean",
  "pullup",
  "dips",
] as const;
export type LiftType = (typeof LIFT_TYPES)[number];

export const LIFT_LABELS: Record<LiftType, string> = {
  squat: "백스쿼트",
  deadlift: "데드리프트",
  bench: "벤치프레스",
  ohp: "오버헤드프레스",
  power_clean: "파워클린",
  pullup: "풀업",
  dips: "딥스",
};

export const LIFT_COLORS: Record<LiftType, string> = {
  squat: "#EF4444",
  deadlift: "#3B82F6",
  bench: "#FACC15",
  ohp: "#22C55E",
  power_clean: "#FCA5A5",
  pullup: "#86EFAC",
  dips: "#C4B5FD",
};

export const E1RM_TREND_LIFTS = ["squat", "deadlift", "bench", "ohp"] as const;
export type E1RMTrendLift = (typeof E1RM_TREND_LIFTS)[number];

export const EMOJI_SCALE = ["😄", "🙂", "😐", "😓", "😵"] as const;
export const SPORT_LABELS = ["가벼웠음", "보통", "평소만큼", "힘들었음", "매우 힘들었음"];
export const FATIGUE_LABELS = ["매우 가뿐", "가뿐", "보통", "피곤", "매우 피곤"];

export const SPLIT_LABELS: Record<string, string> = {
  full_body_3: "무분할 주3",
  full_body_4: "무분할 주4",
  upper_lower_4: "상하체 주4",
  five_split_5: "주5회 나눔",
  custom: "커스텀",
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "상급",
};

export const BODY_PART_LABELS: Record<string, string> = {
  chest: "가슴",
  back: "등",
  legs: "하체",
  shoulders: "어깨",
  arms: "팔",
  core: "코어",
  full_body: "전신",
};

export const QNA_CATEGORY_LABELS: Record<string, string> = {
  training: "훈련",
  nutrition: "영양",
  recovery: "회복",
  equipment: "장비",
  other: "기타",
};

export const COMP_IMPORTANCE_LABELS: Record<string, string> = {
  A: "A · 주요시합",
  B: "B · 일반시합",
  C: "C · 연습경기",
};

export const HABIT_EMOJIS = [
  "🥩", "🥗", "💧", "😴", "🧘", "🏃", "💊", "🧴", "📖", "☀️", "🥛", "🍎",
];

// ========== Phase 3 ==========
export const BOARD_CATEGORIES = [
  "free",
  "training_tip",
  "question",
  "review",
  "recovery",
  "nutrition",
  "equipment",
] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];

export const BOARD_CATEGORY_LABELS: Record<BoardCategory, string> = {
  free: "자유",
  training_tip: "훈련팁",
  question: "질문",
  review: "후기",
  recovery: "회복",
  nutrition: "영양",
  equipment: "장비",
};

export const BOARD_SORT = ["latest", "popular", "comments", "views"] as const;
export type BoardSort = (typeof BOARD_SORT)[number];
export const BOARD_SORT_LABELS: Record<BoardSort, string> = {
  latest: "최신순",
  popular: "인기순",
  comments: "댓글많은순",
  views: "조회순",
};

export const REPORT_REASONS = ["스팸", "욕설", "광고", "기타"] as const;

export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  comment: "댓글",
  like: "좋아요",
  answer: "답변",
  best: "베스트",
  team_assign: "팀 배정",
  competition_reminder: "시합 알림",
  fatigue_alert: "피로 경고",
  mention: "멘션",
  template_assigned: "템플릿 배정",
  coach_note: "코치 메모",
  team_announcement: "팀 공지",
};
