// Athlete-facing accessory card — collapsible, single-expand controlled by parent.
// Collapsed: name, last record summary.
// Expanded: optional exercise change + inline set logger + save/complete.

import { useState } from "react";
import { ExerciseSelectSheet } from "@/components/ExerciseSelectSheet";
import type { ExerciseGroup } from "@/lib/exercise-options";
import { Check, ChevronDown, ChevronUp, Plus, X } from "lucide-react";

export interface SetEntry {
  weight: number;
  reps: number;
  completed: boolean;
}

interface Props {
  exerciseName: string;
  plannedSets: number;
  plannedReps: number;
  plannedWeight: number;
  isBodyweight?: boolean;
  group: ExerciseGroup | null;
  savedSets: SetEntry[] | null;
  completed: boolean;
  carriedIn?: boolean;
  rirHint?: number;
  expanded: boolean;
  onToggle: () => void;
  onSelectExercise?: (name: string) => void;
  onSave: (sets: SetEntry[], complete: boolean, lastRir: number | null) => void;
}

export function AccessoryCompact(props: Props) {
  const {
    exerciseName, plannedSets, plannedReps, plannedWeight, isBodyweight,
    group, savedSets, completed, carriedIn, rirHint = 2,
    expanded, onToggle,
    onSelectExercise, onSave,
  } = props;

  const [pickOpen, setPickOpen] = useState(false);

  const summary = (() => {
    const last = savedSets?.filter((s) => s.completed).slice(-1)[0];
    if (last) return `${last.weight}kg × ${last.reps}회`;
    return `${plannedReps}회 × ${plannedSets}세트${plannedWeight > 0 ? (isBodyweight ? ` + ${plannedWeight}kg` : ` × ${plannedWeight}kg`) : ""}`;
  })();

  return (
    <div
      className={`rounded-2xl border ${
        completed ? "border-primary/50 bg-primary/5" : "border-border bg-card"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold">{exerciseName}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">보조</span>
            {carriedIn && (
              <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold text-warning">↪ 이월</span>
            )}
            {completed && <span className="text-xs">✅</span>}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{summary} · RIR {rirHint}</div>
        </div>
        {expanded ? <ChevronUp size={16} className="mt-1 text-muted-foreground" /> : <ChevronDown size={16} className="mt-1 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          {group && onSelectExercise && (
            <button
              onClick={() => setPickOpen(true)}
              className="mb-3 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-left text-xs"
            >
              <span className="text-muted-foreground">운동 변경 · {group.label}</span>
            </button>
          )}
          <AccessoryRecorder
            exerciseName={exerciseName}
            plannedSets={plannedSets}
            plannedReps={plannedReps}
            plannedWeight={plannedWeight}
            savedSets={savedSets}
            onSubmit={onSave}
          />
        </div>
      )}

      <ExerciseSelectSheet
        open={pickOpen}
        onOpenChange={setPickOpen}
        group={group}
        currentName={exerciseName}
        onSelect={(name) => {
          onSelectExercise?.(name);
          setPickOpen(false);
        }}
      />
    </div>
  );
}

function AccessoryRecorder({
  plannedSets, plannedReps, plannedWeight, savedSets, onSubmit,
}: {
  exerciseName: string;
  plannedSets: number;
  plannedReps: number;
  plannedWeight: number;
  savedSets: SetEntry[] | null;
  onSubmit: (sets: SetEntry[], complete: boolean, lastRir: number | null) => void;
}) {
  const initial: SetEntry[] = savedSets && savedSets.length > 0
    ? savedSets
    : Array.from({ length: Math.max(1, plannedSets) }).map(() => ({
        weight: plannedWeight, reps: plannedReps, completed: false,
      }));
  const [sets, setSets] = useState<SetEntry[]>(initial);
  const [lastRir, setLastRir] = useState<string>("");

  function setField(idx: number, field: keyof SetEntry, val: number | boolean) {
    setSets(sets.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));
  }
  function addSet() {
    const last = sets[sets.length - 1];
    setSets([...sets, { weight: last?.weight ?? plannedWeight, reps: last?.reps ?? plannedReps, completed: false }]);
  }
  function removeSet(idx: number) {
    setSets(sets.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[28px_1fr_1fr_36px_28px] items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
        <span>#</span><span className="text-center">무게(kg)</span><span className="text-center">횟수</span><span className="text-center">완료</span><span></span>
      </div>
      {sets.map((s, i) => (
        <div key={i} className="grid grid-cols-[28px_1fr_1fr_36px_28px] items-center gap-1.5">
          <span className="text-center text-xs font-semibold text-muted-foreground">{i + 1}</span>
          <input
            type="number" inputMode="decimal" step="0.5" value={s.weight}
            onChange={(e) => setField(i, "weight", parseFloat(e.target.value) || 0)}
            className="rounded-md border border-border bg-secondary px-2 py-1.5 text-center text-sm outline-none focus:border-primary"
          />
          <input
            type="number" inputMode="numeric" value={s.reps}
            onChange={(e) => setField(i, "reps", parseInt(e.target.value) || 0)}
            className="rounded-md border border-border bg-secondary px-2 py-1.5 text-center text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => setField(i, "completed", !s.completed)}
            className={`flex h-8 w-9 items-center justify-center rounded-md border-2 ${
              s.completed ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary"
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button onClick={() => removeSet(i)} className="text-muted-foreground">
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addSet}
        className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground"
      >
        <Plus size={12} /> 세트 추가
      </button>

      <label className="flex items-center justify-between gap-3 pt-2">
        <span className="text-xs text-muted-foreground">마지막 세트 RIR</span>
        <input
          type="number" inputMode="numeric" value={lastRir}
          onChange={(e) => setLastRir(e.target.value)}
          className="w-32 rounded-lg border border-border bg-secondary px-3 py-2 text-right text-base font-semibold outline-none focus:border-primary"
        />
      </label>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => onSubmit(sets, false, lastRir === "" ? null : Number(lastRir))}
          className="rounded-xl border border-border py-3 text-sm font-semibold"
        >
          저장
        </button>
        <button
          onClick={() => {
            const next = sets.map((s) => ({ ...s, completed: true }));
            onSubmit(next, true, lastRir === "" ? null : Number(lastRir));
          }}
          className="flex items-center justify-center gap-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          <Check size={14} /> 완료
        </button>
      </div>
    </div>
  );
}
