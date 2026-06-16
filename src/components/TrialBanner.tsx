import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { fetchSubscription, formatTrialBadge, type SubscriptionInfo } from "@/lib/subscription";

export function TrialBanner() {
  const { user } = useAuth();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchSubscription(user.id).then(setInfo);
  }, [user]);

  // 데모 계정: PG 심사관에게 가격이 명확히 보이도록 항상 가격 배너 노출
  const isDemo = user?.email === "demo@bstrength.app";
  if (isDemo) {
    return (
      <Link
        to="/subscribe"
        className="mb-3 block rounded-xl border-2 border-primary/60 bg-gradient-to-r from-primary/15 to-primary/5 px-4 py-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-primary">체험판 이용 중</div>
            <div className="mt-0.5 text-sm font-bold text-foreground">
              정식 이용: 7일 무료 후 <span className="text-primary">월 38,000원</span>
            </div>
          </div>
          <div className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
            가격 보기 →
          </div>
        </div>
      </Link>
    );
  }

  if (!info || !info.row) return null;
  if (info.status === "active" || info.status === "admin_override") return null;

  const expired = !info.isAllowed;
  const accentClass = expired
    ? "border-destructive/50 bg-destructive/10 text-destructive"
    : info.endingSoon
      ? "border-warning/50 bg-warning/10 text-warning"
      : "border-primary/40 bg-primary/10 text-primary";

  return (
    <Link
      to="/subscribe"
      className={`mb-3 block rounded-xl border px-3 py-2 text-sm font-semibold ${accentClass}`}
    >
      {expired ? "무료체험이 종료되었습니다. 자세히 보기 →" : `${formatTrialBadge(info)} · 월 38,000원 · 자세히 보기 →`}
    </Link>
  );
}
