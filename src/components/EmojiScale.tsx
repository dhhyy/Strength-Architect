import { EMOJI_SCALE } from "@/lib/types";

interface Props {
  value: number | null;
  onChange: (v: number) => void;
  labels?: string[];
}

export function EmojiScale({ value, onChange, labels }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {EMOJI_SCALE.map((e, i) => {
        const v = i + 1;
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex flex-col items-center justify-center gap-1 rounded-xl border py-2 transition-all active:scale-95 ${
              active
                ? "border-primary bg-primary/10 ring-2 ring-primary"
                : "border-border bg-secondary"
            }`}
          >
            <span className="text-2xl leading-none">{e}</span>
            {labels && (
              <span
                className={`text-[10px] leading-tight ${
                  active ? "font-semibold text-primary" : "text-muted-foreground"
                }`}
              >
                {labels[i]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
