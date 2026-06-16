import { useState } from "react";
import { addDaysStr } from "@/lib/carryover";

interface Props {
  open: boolean;
  fromDate: string;
  title: string;
  description?: string;
  onClose: () => void;
  onConfirm: (toDate: string) => void | Promise<void>;
}

export function CarryoverDateDialog({ open, fromDate, title, description, onClose, onConfirm }: Props) {
  const [date, setDate] = useState(addDaysStr(fromDate, 1));
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function go(d?: string) {
    const target = d ?? date;
    if (target === fromDate) return;
    setBusy(true);
    try {
      await onConfirm(target);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}

        <div className="mt-4 text-xs text-muted-foreground">이월할 날짜</div>
        <input
          type="date"
          value={date}
          min={addDaysStr(fromDate, 1)}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-3 text-base outline-none focus:border-primary"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {[1, 2, 3, 7].map((n) => {
            const d = addDaysStr(fromDate, n);
            const label = n === 1 ? "내일" : n === 7 ? "다음주" : `${n}일 후`;
            return (
              <button
                key={n}
                onClick={() => setDate(d)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  date === d ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3">
            취소
          </button>
          <button
            disabled={busy || date <= fromDate}
            onClick={() => go()}
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy ? "이월 중…" : "이월하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
