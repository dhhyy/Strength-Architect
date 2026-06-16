// Athlete-facing main lift card — collapsible, single-expand controlled by parent.
// Collapsed: name, mode badge, last record line, mode-select buttons.
// Expanded: plan (rep range, RIR) + recommendation + record inputs inline.
// No settings sheet, no separate record sheet.

import { useMemo, useState } from "react";
import {
  type MainLogV1,
  type ExecutionMode,
  readMainLog,
} from "@/lib/main-lift";
import type { MainGoal } from "@/lib/goal-ranges";
import type { Condition } from "@/lib/condition";
import {
  predictTopSetReps,
  recommendBackoffWeightRange,
  recommendBackoffRepRange,
  BACKOFF_TARGET_RIR,
} from "@/lib/recommendation";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  liftType: string;
  exerciseName: string;
  e1rm: number;
  plannedSets: number;
  plannedReps: number;
  goal: MainGoal;
  repLow: number;
  repHigh: number;
  condition: Condition | null;
  rawLog: unknown;
  completed: boolean;
  carriedIn?: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: MainLogV1, opts?: { complete?: boolean }) => void;
}

function modeLabel(m: ExecutionMode) {
  return m === "rir_working" ? "정해진 세트" : "탑세트+백오프";
}

function lastRecordLine(log: MainLogV1): string {
  const completed = log.working_sets.filter((s) => s.completed);
  const last = completed[completed.length - 1];
  if (!last) return "기록 없음";
  const rir = last.rir != null ? ` · RIR ${last.rir}` : "";
  return `${last.weight}kg × ${last.reps}회${rir}`;
}

export function MainLiftCompact(props: Props) {
  const {
    liftType, exerciseName, e1rm, plannedSets, plannedReps,
    goal, repLow, repHigh, condition,
    rawLog, completed, carriedIn, expanded, onToggle, onChange,
  } = props;

  const buildArgs = { liftType, e1rm, plannedSets, plannedReps, goal, repLow, repHigh, condition };
  const initial = useMemo(() => readMainLog(rawLog, buildArgs), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [log, setLog] = useState<MainLogV1>(initial);

  function push(next: MainLogV1, complete?: boolean) {
    setLog(next);
    onChange(next, { complete });
  }

  function setMode(m: ExecutionMode) {
    if (m === log.execution_mode) return;
    push({ ...log, execution_mode: m });
  }

  return (
    <div
      className={`rounded-2xl border ${
        completed ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      {/* Header: tap to toggle expansion */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{exerciseName}</span>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {modeLabel(log.execution_mode)}
            </span>
            {carriedIn && (
              <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold text-warning">↪ 이월</span>
            )}
            {completed && <span className="text-xs">✅</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{lastRecordLine(log)}</div>
        </div>
        {expanded ? <ChevronUp size={16} className="mt-1 text-muted-foreground" /> : <ChevronDown size={16} className="mt-1 text-muted-foreground" />}
      </button>

      {/* Mode selector (always visible) */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <ModeBtn active={log.execution_mode === "rir_working"} onClick={() => setMode("rir_working")}>
          정해진 세트
        </ModeBtn>
        <ModeBtn active={log.execution_mode === "top_backoff"} onClick={() => setMode("top_backoff")}>
          탑세트+백오프
        </ModeBtn>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {log.execution_mode === "rir_working" ? (
            <FixedSetsPanel log={log} onSave={push} />
          ) : (
            <TopBackoffPanel log={log} onSave={push} />
          )}
        </div>
      )}
    </div>
  );
}

function ModeBtn({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border py-2 text-xs font-semibold transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function NumRow({
  label, value, onChange, step,
}: { label: string; value: string; onChange: (v: string) => void; step: string }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 rounded-lg border border-border bg-secondary px-3 py-2 text-right text-base font-semibold outline-none focus:border-primary"
      />
    </label>
  );
}

// ───────── Fixed-sets (RIR working) panel ─────────
function FixedSetsPanel({
  log, onSave,
}: { log: MainLogV1; onSave: (next: MainLogV1, complete?: boolean) => void }) {
  const [workW, setWorkW] = useState<string>(
    log.actual_selected_weight ? String(log.actual_selected_weight) :
      log.recommended_start_weight ? String(log.recommended_start_weight) : "",
  );
  const [workReps, setWorkReps] = useState<string>(() => {
    const last = log.working_sets[log.working_sets.length - 1];
    return last?.reps ? String(last.reps) : String(log.planned.reps_low);
  });
  const [workRir, setWorkRir] = useState<string>(() => {
    const last = log.working_sets[log.working_sets.length - 1];
    return last?.rir != null ? String(last.rir) : "";
  });
  const [amrap, setAmrap] = useState<boolean>(!!log.planned.amrap_enabled);
  const [amrapReps, setAmrapReps] = useState<string>("");

  function save(finish: boolean) {
    const w = Number(workW) || 0;
    const reps = Number(workReps) || log.planned.reps_low;
    const r = workRir === "" ? null : Number(workRir);
    const sets = Math.max(1, log.planned.sets);
    const lastReps = amrap && amrapReps ? (Number(amrapReps) || reps) : reps;
    const working = Array.from({ length: sets }).map((_, i) => ({
      weight: w,
      reps: i === sets - 1 ? lastReps : reps,
      rir: i === sets - 1 ? r : null,
      completed: finish,
    }));
    onSave(
      {
        ...log,
        actual_selected_weight: w || null,
        planned: { ...log.planned, amrap_enabled: amrap },
        working_sets: working,
      },
      finish,
    );
  }

  return (
    <div className="space-y-3">
      {/* Plan */}
      <div className="rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
        계획 · {log.planned.sets}세트 × {log.planned.reps_low}~{log.planned.reps_high}회 · RIR {log.planned.target_rir[0]}~{log.planned.target_rir[1]}
        {log.recommended_start_weight ? ` · 추천 ${log.recommended_start_weight}kg` : ""}
      </div>
      {/* Record */}
      <NumRow label="중량 (kg)" value={workW} onChange={setWorkW} step="0.5" />
      <NumRow label="반복수" value={workReps} onChange={setWorkReps} step="1" />
      <NumRow label="마지막 세트 RIR" value={workRir} onChange={setWorkRir} step="1" />
      <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2">
        <span className="text-xs font-semibold">마지막 세트 AMRAP</span>
        <input
          type="checkbox"
          checked={amrap}
          onChange={(e) => setAmrap(e.target.checked)}
          className="h-4 w-4"
        />
      </label>
      {amrap && (
        <NumRow label="AMRAP 반복수" value={amrapReps} onChange={setAmrapReps} step="1" />
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={() => save(false)} className="rounded-xl border border-border py-3 text-sm font-semibold">
          저장
        </button>
        <button onClick={() => save(true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
          <Check size={14} /> 완료
        </button>
      </div>
    </div>
  );
}

// ───────── Top + Backoff panel ─────────
function TopBackoffPanel({
  log, onSave,
}: { log: MainLogV1; onSave: (next: MainLogV1, complete?: boolean) => void }) {
  const [topW, setTopW] = useState<string>(
    log.topset.input_weight ? String(log.topset.input_weight) :
      log.topset.actual_weight ? String(log.topset.actual_weight) :
        log.recommended_topset_weight ? String(log.recommended_topset_weight) : "",
  );
  const [topActualW, setTopActualW] = useState<string>(
    log.topset.actual_weight ? String(log.topset.actual_weight) : "",
  );
  const [topReps, setTopReps] = useState<string>(
    log.topset.actual_reps != null ? String(log.topset.actual_reps) : "",
  );
  const [topRir, setTopRir] = useState<string>(
    log.topset.actual_rir != null ? String(log.topset.actual_rir) : "",
  );
  const [backW, setBackW] = useState<string>(
    log.backoff.actual_weight ? String(log.backoff.actual_weight) : "",
  );
  const [backReps, setBackReps] = useState<string>(
    log.backoff.actual_reps != null ? String(log.backoff.actual_reps) : "",
  );
  const [backRir, setBackRir] = useState<string>(
    log.backoff.actual_rir != null ? String(log.backoff.actual_rir) : "",
  );

  const topSuggestion = useMemo(() => {
    const w = Number(topW);
    return predictTopSetReps(w, log.e1rm_used, log.topset.target_rir ?? 1);
  }, [topW, log.e1rm_used, log.topset.target_rir]);

  const backoffWeightRange = useMemo(() => {
    const base = Number(topActualW) || Number(topW);
    return recommendBackoffWeightRange(base);
  }, [topActualW, topW]);
  const backoffRepRange = useMemo(
    () => recommendBackoffRepRange(log.topset.reps_low, log.topset.reps_high),
    [log.topset.reps_low, log.topset.reps_high],
  );

  function save(finish: boolean) {
    const tInput = Number(topW) || 0;
    const tw = Number(topActualW) || tInput;
    const tr = Number(topReps) || log.topset.reps_low;
    const trir = topRir === "" ? null : Number(topRir);
    const bw = Number(backW) || 0;
    const br = Number(backReps) || log.backoff.reps_low;
    const brir = backRir === "" ? null : Number(backRir);
    const working = [
      { weight: tw, reps: tr, rir: trir, completed: finish },
      ...Array.from({ length: Math.max(1, log.backoff.sets) }).map((_, i, arr) => ({
        weight: bw,
        reps: br,
        rir: i === arr.length - 1 ? brir : null,
        completed: finish,
      })),
    ];
    onSave(
      {
        ...log,
        topset: {
          ...log.topset,
          input_weight: tInput || null,
          actual_weight: tw || null,
          actual_reps: tr || null,
          actual_rir: trir,
          suggested_rep_min: topSuggestion?.min ?? null,
          suggested_rep_max: topSuggestion?.max ?? null,
        },
        backoff: {
          ...log.backoff,
          actual_weight: bw || null,
          actual_reps: br || null,
          actual_rir: brir,
          recommended_weight_min: backoffWeightRange?.min ?? null,
          recommended_weight_max: backoffWeightRange?.max ?? null,
          recommended_rep_min: backoffRepRange.min,
          recommended_rep_max: backoffRepRange.max,
          target_rir_min: BACKOFF_TARGET_RIR.min,
          target_rir_max: BACKOFF_TARGET_RIR.max,
        },
        working_sets: working,
      },
      finish,
    );
  }

  return (
    <div className="space-y-3">
      {/* Top set */}
      <section className="rounded-xl border border-border p-3">
        <div className="mb-2 text-xs font-semibold">탑세트</div>
        <div className="space-y-2">
          <div className="rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
            목표 {log.topset.reps_low}~{log.topset.reps_high}회 · RIR {log.topset.target_rir}
          </div>
          <NumRow label="입력 중량 (kg)" value={topW} onChange={setTopW} step="0.5" />
          {topSuggestion && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] text-primary">
              예상 반복 <span className="font-bold">{topSuggestion.min}~{topSuggestion.max}회</span>
            </div>
          )}
          <NumRow label="실제 중량 (kg)" value={topActualW} onChange={setTopActualW} step="0.5" />
          <NumRow label="실제 반복수" value={topReps} onChange={setTopReps} step="1" />
          <NumRow label="RIR" value={topRir} onChange={setTopRir} step="1" />
        </div>
      </section>

      {/* Backoff */}
      <section className="rounded-xl border border-border p-3">
        <div className="mb-2 text-xs font-semibold">백오프</div>
        <div className="space-y-2">
          {backoffWeightRange && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-[11px] text-primary">
              백오프 추천 <span className="font-bold">{backoffWeightRange.min}~{backoffWeightRange.max}kg</span> · {backoffRepRange.min}~{backoffRepRange.max}회 · RIR {BACKOFF_TARGET_RIR.min}~{BACKOFF_TARGET_RIR.max}
            </div>
          )}
          <NumRow label="중량 (kg)" value={backW} onChange={setBackW} step="0.5" />
          <NumRow label="반복수" value={backReps} onChange={setBackReps} step="1" />
          <NumRow label="마지막 백오프 RIR" value={backRir} onChange={setBackRir} step="1" />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={() => save(false)} className="rounded-xl border border-border py-3 text-sm font-semibold">
          저장
        </button>
        <button onClick={() => save(true)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
          <Check size={14} /> 완료
        </button>
      </div>
    </div>
  );
}
