# MVP 주문서 A — 구현 계획

## 핵심 방향

- 앱 전체 구조(빠르게 시작 / 직접 만들기, /today 카드, 메인 운동 카드)는 유지합니다.
- "오늘 컨디션은?" 자동 시트는 **제거**합니다. (선수가 메인 카드에서 직접 fixed_sets / top_backoff 선택)
- 모든 메인 운동 UI에서 **퍼센트(%)는 노출하지 않습니다.** 무게는 항상 "범위 추천"으로만 표시합니다.
- AI/ML 없이 **규칙 기반(rule-based)** 으로 e1RM과 범위 추천을 계산합니다.

---

## 1. 데이터 모델 (DB 마이그레이션)

### `athlete_routine_assignments` 컬럼 추가
- `sport_training_stress_level` text (낮음/보통/높음/매우높음)
- `strength_training_tolerance` text (낮음/보통/높음)
- `current_goal` text (근비대/스트렝스/파워/유지/보강)
- `competition_weeks_out` int (2/4/6/8/12)
- `weekly_program_mode` text (auto/weekly_manual)
- `priority_focus_1`, `priority_focus_2`, `priority_focus_3` text
- `main_prescription_preference` text (fixed_sets/top_backoff/mixed)
- `target_rep_zone` text (예: "6-8", "1-3")

(기존 `main_goal`, `main_rep_low`, `main_rep_high` 는 유지하되 신규 컬럼이 우선)

### `workout_logs.set_logs` JSON 스키마 확장
새 스키마 `main_v2`를 추가 (기존 `main_v1` 자동 마이그레이션):

```
{
  schema: "main_v2",
  execution_mode: "fixed_sets" | "top_backoff",
  target_rep_zone: "6-8",
  // fixed_sets
  planned_sets, planned_reps_or_range, target_rir, amrap_enabled,
  actual_weight, actual_reps, actual_rir,
  // top_backoff
  top_set: { input_weight, suggested_rep_min, suggested_rep_max,
             actual_weight, actual_reps, actual_rir },
  backoff: { recommended_weight_min, recommended_weight_max,
             recommended_rep_min, recommended_rep_max,
             target_rir_min, target_rir_max,
             actual_weight, actual_reps, actual_rir },
  estimated_e1rm_after_session: number | null,
}
```

`daily_checkins.condition` 컬럼은 그대로 두되 자동 시트는 호출하지 않습니다 (수동 기록만).

---

## 2. 신규/수정 파일

### 신규
- `src/lib/recommendation.ts` — Epley-RIR 역계산으로 입력 탑세트 무게 → 예상 반복 범위, 백오프 중량/반복 범위 계산
- `src/lib/routine-inputs.ts` — 입력 옵션 enum (스트레스/감당량/목표/주차/우선순위/처방선호/렙존)
- `src/components/TopBackoffSheet.tsx` — 탑세트 무게 입력 → 추천 범위 표시 → 기록 → 백오프 범위 표시 → 기록
- `src/components/FixedSetsSheet.tsx` — 5x5 등 고정 세트, AMRAP 옵션, 기록 입력

### 수정
- `src/routes/templates.tsx` — 루틴 생성 마법사에 9개 신규 항목 step 추가, assignment insert 시 모두 저장
- `src/lib/main-lift.ts` — `main_v2` 스키마 + `readMainLog` 마이그레이션, `buildMainLog` 가 신규 assignment 필드 기반으로 초기화
- `src/components/MainLiftCompact.tsx` — 카드에 fixed_sets / top_backoff 토글 노출, 모드별 시트 호출
- `src/components/MainLiftCard.tsx` — 설정 시트 단순화 (% 완전 제거, 모드 토글 제거 — 카드에서 처리)
- `src/routes/_app.today.tsx` — ConditionSheet 자동오픈 **제거**. 수동 컨디션 버튼은 유지 가능
- `src/lib/e1rm.ts` — `recomputeAndStoreE1rm` 는 그대로 사용, 결과를 `set_logs.estimated_e1rm_after_session` 에 함께 저장

### 변경 없음
- `src/lib/condition.ts` — 파일은 유지 (수동 컨디션 기록용), 자동 트리거만 제거

---

## 3. 추천 엔진 (rule-based)

### 입력 탑세트 무게 → 예상 반복
- Epley 역산: `reps ≈ ((e1rm / weight) - 1) * 30 - target_rir`
- 범위 = `[round(reps_est) - 1, round(reps_est) + 1]`, target_rep_zone 으로 clamp

### 백오프 추천
- `backoff_weight_high = top_actual_weight * 0.90`
- `backoff_weight_low  = top_actual_weight * 0.85`
- `backoff_reps` = target_rep_zone 의 +2~+4 (RIR 3~4 여유)
- `target_rir_min=3, target_rir_max=4`

### e1RM 갱신
- 기존 `estimateE1rm` (Epley + RIR) + `blendE1rm` (60/40, 다운스윙 5kg 캡) 재사용
- 탑세트 기록이 있으면 탑세트 우선, 없으면 워킹세트로 갱신

---

## 4. 루틴 생성 규칙 (rule-based, 경량)

`src/lib/routine-engine.ts` 의 스냅샷 생성 시 신규 assignment 필드 반영:

1. `sport_training_stress_level >= 높음 && strength_training_tolerance == 낮음`
   → 메인 백오프 sets `-1`, 보조운동 슬롯 `-1`
2. `competition_weeks_out <= 4`
   → 보조운동 슬롯 `-1`, 메인 sets 유지
3. `priority_focus_*` 가 메인 운동명이면 해당 운동의 주간 빈도 +1 슬롯
   부위면 관련 보조운동 슬롯 +1 (1순위>2순위>3순위)
4. `main_prescription_preference` → MainLogV1.execution_mode 기본값
5. `target_rep_zone` → planned reps_low/high 기본값

(복잡한 분배는 MVP 범위 밖)

---

## 5. UI 흐름 변경

### /today
- ConditionSheet 자동 오픈 제거.
- 컨디션은 상단 작은 칩 버튼 (탭하면 시트, 옵션)

### 메인 운동 카드
- 카드 본문: 운동명 + 현재 모드 배지 (fixed_sets / top_backoff)
- 카드 액션: `[방식 바꾸기] [운동 시작]`
- "방식 바꾸기" → fixed_sets / top_backoff 2지선다 시트
- "운동 시작" → 선택된 모드에 맞는 기록 시트 (FixedSetsSheet / TopBackoffSheet)

### TopBackoffSheet 단계
1. 탑세트 입력 무게 → 추천 반복 범위 즉시 표시
2. 탑세트 실제 weight/reps/RIR 기록
3. 백오프 추천 중량/반복/RIR 자동 표시
4. 백오프 실제 기록

### FixedSetsSheet
- 5x5 등 표시, 마지막 세트 AMRAP 토글, 무게/반복/RIR 기록

---

## 6. MVP 제외 (이번 턴 안 함)

- 퍼센트 노출, 컨디션 자동 시트, 강제 중량, 속도 측정, ML 예측, 차트, 피로도 대시보드.

---

## 7. 완료 검증 체크리스트

- [ ] 루틴 생성 마법사에서 9개 신규 항목 입력 → assignment 저장 확인 (psql)
- [ ] 메인 카드에서 fixed_sets/top_backoff 토글 동작
- [ ] 탑세트 무게 입력 시 추천 반복 범위 표시
- [ ] 탑세트 기록 후 백오프 중량/반복 범위 표시
- [ ] 기록 저장 시 athlete_lifts.e1rm 갱신 확인
- [ ] set_logs.estimated_e1rm_after_session 저장 확인

---

**기능 실현 가능성에 대한 답:**
탑세트 입력 무게 → 예상 반복 범위, 백오프 무게+반복 범위 추천은 **기록만으로 충분히 가능**합니다. e1RM 추정(Epley + RIR)을 역으로 풀면 됩니다. 단일 정답이 아닌 ±1회 범위로 제시하고, 기록이 쌓일수록 e1RM 보정으로 정확도가 점진적으로 올라갑니다.
