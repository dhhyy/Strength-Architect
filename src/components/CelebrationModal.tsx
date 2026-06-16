import { useEffect } from "react";

interface Props {
  open: boolean;
  emoji?: string;
  title: string;
  description?: string;
  onClose: () => void;
  autoCloseMs?: number;
}

export function CelebrationModal({
  open,
  emoji = "🎉",
  title,
  description,
  onClose,
  autoCloseMs = 4000,
}: Props) {
  useEffect(() => {
    if (!open || !autoCloseMs) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border-2 border-primary bg-card p-8 text-center shadow-2xl shadow-primary/30 animate-in zoom-in-95"
      >
        <div className="text-7xl">{emoji}</div>
        <h2 className="mt-4 text-2xl font-bold text-primary">{title}</h2>
        {description && (
          <p className="mt-3 text-base text-foreground/80 leading-relaxed">{description}</p>
        )}
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground active:scale-95"
        >
          확인
        </button>
      </div>
    </div>
  );
}
