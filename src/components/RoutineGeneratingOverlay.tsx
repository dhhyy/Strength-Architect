import { useEffect, useState } from "react";

const SUB_MESSAGES = [
  "운동 우선순위를 정리하고 있습니다",
  "주간 훈련 일정을 배치하고 있습니다",
  "회복 예산을 반영하고 있습니다",
];

interface Props {
  open: boolean;
  error: string | null;
  onRetry: () => void;
  onCancel?: () => void;
}

export function RoutineGeneratingOverlay({ open, error, onRetry, onCancel }: Props) {
  const [subIdx, setSubIdx] = useState(0);

  useEffect(() => {
    if (!open || error) return;
    setSubIdx(0);
    const t = setInterval(() => setSubIdx((i) => (i + 1) % SUB_MESSAGES.length), 1000);
    return () => clearInterval(t);
  }, [open, error]);

  // Block browser back during generation
  useEffect(() => {
    if (!open || error) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const pushState = () => window.history.pushState(null, "", window.location.href);
    pushState();
    const popHandler = () => pushState();
    window.addEventListener("beforeunload", handler);
    window.addEventListener("popstate", popHandler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("popstate", popHandler);
    };
  }, [open, error]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0a0d12] text-foreground animate-in fade-in">
      {/* Top: app name */}
      <header className="px-6 pt-8">
        <div className="text-sm font-bold tracking-widest text-primary">BEAST STRENGTH</div>
        <div className="mt-1 text-xs text-muted-foreground">루틴 생성</div>
      </header>

      {/* Center */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Visual */}
        <div className="relative h-48 w-full max-w-xs">
          <svg viewBox="0 0 320 180" className="h-full w-full" fill="none">
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0" />
                <stop offset="50%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* grid */}
            {[30, 70, 110, 150].map((y) => (
              <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="#1e293b" strokeDasharray="2 4" />
            ))}
            {/* area */}
            <path
              d="M0,140 L40,120 L80,100 L120,110 L160,70 L200,80 L240,50 L280,60 L320,30 L320,180 L0,180 Z"
              fill="url(#areaGrad)"
              className="animate-pulse"
            />
            {/* line */}
            <path
              d="M0,140 L40,120 L80,100 L120,110 L160,70 L200,80 L240,50 L280,60 L320,30"
              stroke="url(#lineGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* dots */}
            {[[40, 120], [120, 110], [200, 80], [280, 60]].map(([x, y], i) => (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill="#22d3ee"
                className="animate-pulse"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </svg>
          {/* Spinner */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          </div>
        </div>

        {!error ? (
          <>
            <h2 className="mt-8 text-center text-xl font-bold text-foreground">
              선수님의 루틴을 생성하고 있습니다
            </h2>
            <p className="mt-3 h-5 text-center text-sm text-cyan-300/80 transition-opacity">
              {SUB_MESSAGES[subIdx]}
            </p>

            {/* Loading bar */}
            <div className="mt-8 w-full max-w-xs overflow-hidden rounded-full bg-slate-800/80">
              <div className="h-1.5 w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 animate-[loadingBar_1.6s_ease-in-out_infinite]" />
            </div>
          </>
        ) : (
          <>
            <h2 className="mt-8 text-center text-xl font-bold text-red-400">
              루틴 생성에 실패했습니다
            </h2>
            <p className="mt-3 text-center text-sm text-muted-foreground">{error}</p>
            <div className="mt-6 flex w-full max-w-xs gap-2">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-xl border border-border bg-card py-3 text-sm font-semibold"
                >
                  취소
                </button>
              )}
              <button
                onClick={onRetry}
                className="flex-1 rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-900"
              >
                다시 시도
              </button>
            </div>
          </>
        )}
      </main>

      <style>{`
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
