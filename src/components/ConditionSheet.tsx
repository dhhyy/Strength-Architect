import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CONDITION_DESC, CONDITION_EMOJI, CONDITION_LABELS, type Condition } from "@/lib/condition";

interface Props {
  open: boolean;
  current: Condition | null;
  onPick: (c: Condition) => void;
  onClose: () => void;
}

const ORDER: Condition[] = ["ready", "normal", "low"];

export function ConditionSheet({ open, current, onPick, onClose }: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>오늘 컨디션은?</SheetTitle>
          <SheetDescription className="text-xs">
            컨디션에 따라 메인 운동 수행 방식이 자동으로 추천돼요. 언제든 직접 바꿀 수 있어요.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-2 pb-6">
          {ORDER.map((c) => {
            const active = current === c;
            return (
              <button
                key={c}
                onClick={() => { onPick(c); onClose(); }}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition ${
                  active ? "border-primary bg-primary/10" : "border-border bg-card"
                }`}
              >
                <span className="text-2xl">{CONDITION_EMOJI[c]}</span>
                <div className="flex-1">
                  <div className="font-bold">{CONDITION_LABELS[c]}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{CONDITION_DESC[c]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
