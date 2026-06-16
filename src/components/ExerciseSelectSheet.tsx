import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Check } from "lucide-react";
import type { ExerciseGroup } from "@/lib/exercise-options";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  group: ExerciseGroup | null;
  currentName: string;
  onSelect: (name: string) => void;
}

export function ExerciseSelectSheet({ open, onOpenChange, group, currentName, onSelect }: Props) {
  if (!group) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>{group.label} · 운동 선택</SheetTitle>
          <SheetDescription className="text-xs">
            선택한 운동은 오늘만 적용됩니다. 과거 기록은 변경되지 않습니다.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2 pb-6">
          {group.options.map((opt) => {
            const active = opt === currentName;
            return (
              <button
                key={opt}
                onClick={() => {
                  onSelect(opt);
                  onOpenChange(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                  active
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-card"
                }`}
              >
                <span>{opt}</span>
                {active && <Check size={16} />}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
