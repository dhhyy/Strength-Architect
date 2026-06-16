// Athlete-facing main lift settings sheet body.
// Used INSIDE MainLiftCompact's settings sheet.
// No % shown — only goal, rep range, RIR, and recommended start weights.

import { useState } from "react";
import {
  type MainLogV1,
  type ExecutionMode,
} from "@/lib/main-lift";
import {
  HYPERTROPHY_RANGES,
  STRENGTH_RANGES,
  type MainGoal,
  type RepRangeOption,
  recommendedStartWeight,
  recommendedTopsetWeight,
  recommendedBackoffWeight,
} from "@/lib/goal-ranges";
import { CONDITION_LABELS, type Condition } from "@/lib/condition";

interface Props {
  exerciseName: string;
  e1rm: number;
  log: MainLogV1;
  condition: Condition | null;
  onChange: (next: MainLogV1) => void;
}

function Toggle<T extends string>({
  value, options, onChange,
}: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex w-full rounded-lg border border-border bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold ${
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MainLiftCard({ exerciseName, e1rm, log, condition, onChange }: Props) {
  const [showRef, setShowRef] = useState(false);
  const goal: MainGoal = log.goal;
  const ranges = goal === "strength" ? STRENGTH_RANGES : HYPERTROPHY_RANGES;

  function applyRange(r: RepRangeOption) {
    const startW = recommendedStartWeight(e1rm, goal, r.low, r.high);
    const topW = recommendedTopsetWeight(e1rm, goal, r.low);
    const backW = recommendedBackoffWeight(topW);
    onChange({
      ...log,
      planned: { ...log.planned, reps_low: r.low, reps_high: r.high },
      topset: { ...log.topset, reps_low: r.low, reps_high: r.high },
      backoff: { ...log.backoff, reps_low: r.low, reps_high: r.high },
      recommended_start_weight: startW,
      recommended_topset_weight: topW,
      recommended_backoff_weight: backW,
    });
  }

  function applyGoal(g: MainGoal) {
    const fallback = (g === "strength" ? STRENGTH_RANGES : HYPERTROPHY_RANGES)[1];
    const startW = recommendedStartWeight(e1rm, g, fallback.low, fallback.high);
    const topW = recommendedTopsetWeight(e1rm, g, fallback.low);
    const backW = recommendedBackoffWeight(topW);
    onChange({
      ...log,
      goal: g,
      planned: { ...log.planned, reps_low: fallback.low, reps_high: fallback.high },
      topset: { ...log.topset, reps_low: fallback.low, reps_high: fallback.high },
      backoff: { ...log.backoff, reps_low: fallback.low, reps_high: fallback.high },
      recommended_start_weight: startW,
      recommended_topset_weight: topW,
      recommended_backoff_weight: backW,
    });
  }

  function applyExec(m: ExecutionMode) {
    onChange({ ...log, execution_mode: m });
  }

  return (
    <div className="space-y-4 pb-2">
      <div>
        <div className="text-lg font-bold">{exerciseName}</div>
        {condition && (
          <div className="mt-0.5 text-xs text-muted-foreground">
            오늘 컨디션: {CONDITION_LABELS[condition]}
          </div>
        )}
      </div>

      <Section title="목표">
        <Toggle
          value={goal}
          options={[
            { v: "hypertrophy", label: "근비대" },
            { v: "strength", label: "스트렝스" },
          ]}
          onChange={applyGoal}
        />
      </Section>

      <Section title="반복 범위">
        <div className="grid grid-cols-3 gap-2">
          {ranges.map((r) => {
            const active = r.low === log.planned.reps_low && r.high === log.planned.reps_high;
            return (
              <button
                key={r.label}
                onClick={() => applyRange(r)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="수행 방식">
        <Toggle
          value={log.execution_mode}
          options={[
            { v: "rir_working", label: "기본 세트(고정)" },
            { v: "top_backoff", label: "탑세트 + 백오프" },
          ]}
          onChange={applyExec}
        />
      </Section>

      <Section title="목표 RIR">
        {log.execution_mode === "rir_working" ? (
          <RirRangeRow
            value={log.planned.target_rir}
            onChange={(v) => onChange({ ...log, planned: { ...log.planned, target_rir: v } })}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <RirSingleRow
              label="탑세트"
              value={log.topset.target_rir}
              onChange={(v) => onChange({ ...log, topset: { ...log.topset, target_rir: v } })}
            />
            <RirSingleRow
              label="백오프(마지막)"
              value={log.backoff.target_rir}
              onChange={(v) => onChange({ ...log, backoff: { ...log.backoff, target_rir: v } })}
            />
          </div>
        )}
      </Section>

      <Section title="세트 수">
        {log.execution_mode === "rir_working" ? (
          <NumberStepper
            value={log.planned.sets}
            onChange={(v) => onChange({ ...log, planned: { ...log.planned, sets: v } })}
            min={1}
            max={10}
            suffix="세트"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">탑세트</div>
              <NumberStepper
                value={log.topset.sets}
                onChange={(v) => onChange({ ...log, topset: { ...log.topset, sets: v } })}
                min={1} max={5} suffix="세트"
              />
            </div>
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">백오프</div>
              <NumberStepper
                value={log.backoff.sets}
                onChange={(v) => onChange({ ...log, backoff: { ...log.backoff, sets: v } })}
                min={1} max={6} suffix="세트"
              />
            </div>
          </div>
        )}
      </Section>

      <div className="rounded-xl border border-border bg-secondary/40 p-3 text-xs">
        <button onClick={() => setShowRef((v) => !v)} className="flex w-full items-center justify-between">
          <span className="font-semibold">추천 시작중량 (참고)</span>
          <span className="text-muted-foreground">{showRef ? "숨기기" : "보기"}</span>
        </button>
        {showRef && (
          <div className="mt-2 space-y-1 text-muted-foreground">
            {e1rm > 0 ? (
              <>
                {log.execution_mode === "rir_working" ? (
                  <div>워킹세트 시작: <span className="font-semibold text-foreground">약 {log.recommended_start_weight ?? "—"}kg</span></div>
                ) : (
                  <>
                    <div>탑세트 시작: <span className="font-semibold text-foreground">약 {log.recommended_topset_weight ?? "—"}kg</span></div>
                    <div>백오프 시작: <span className="font-semibold text-foreground">약 {log.recommended_backoff_weight ?? "—"}kg</span></div>
                  </>
                )}
                <div className="text-[10px]">* 강제값 아님. 컨디션에 맞게 직접 결정하세요.</div>
              </>
            ) : (
              <div>기록이 쌓이면 추천 시작중량이 자동으로 보정됩니다.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-xs font-semibold text-muted-foreground">{title}</div>
      {children}
    </section>
  );
}

function NumberStepper({
  value, onChange, min, max, suffix,
}: { value: number; onChange: (v: number) => void; min: number; max: number; suffix?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="h-7 w-7 rounded-md bg-secondary text-sm">−</button>
      <span className="min-w-12 text-center text-sm font-semibold">{value}{suffix ? ` ${suffix}` : ""}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} className="h-7 w-7 rounded-md bg-secondary text-sm">+</button>
    </div>
  );
}

function RirRangeRow({
  value, onChange,
}: { value: [number, number]; onChange: (v: [number, number]) => void }) {
  return (
    <div className="flex items-center gap-2">
      <NumberStepper
        value={value[0]}
        onChange={(v) => onChange([v, Math.max(v, value[1])])}
        min={0} max={5}
      />
      <span className="text-xs text-muted-foreground">~</span>
      <NumberStepper
        value={value[1]}
        onChange={(v) => onChange([Math.min(value[0], v), v])}
        min={0} max={5}
      />
      <span className="text-[11px] text-muted-foreground">(마지막 세트)</span>
    </div>
  );
}

function RirSingleRow({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{label}</div>
      <NumberStepper value={value} onChange={onChange} min={0} max={5} />
    </div>
  );
}
