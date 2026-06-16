import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchSubscription, STATUS_LABEL, type SubscriptionInfo } from "@/lib/subscription";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/subscribe")({
  component: SubscribePage,
});

function SubscribePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchSubscription(user.id).then(setInfo);
  }, [user]);

  if (loading) return <div className="p-8 text-muted-foreground">로딩…</div>;
  if (!user) return <Navigate to="/login" replace />;

  const row = info?.row;
  const expired = info ? !info.isAllowed : false;

  return (
    <div className="container-mobile py-10 pb-20">
      <h1 className="text-3xl font-bold text-primary">구독</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        가입 후 7일간 무료로 모든 기능을 사용해보세요.
      </p>

      {/* 가격 카드 */}
      <section className="mt-6 rounded-2xl border-2 border-primary/60 bg-gradient-to-br from-primary/10 to-primary/5 p-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            프리미엄 멤버십
          </span>
          <span className="text-xs text-muted-foreground">7일 무료체험 포함</span>
        </div>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">38,000</span>
          <span className="text-lg font-semibold text-muted-foreground">원 / 월</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          첫 7일은 무료이며, 이후 매월 자동 결제됩니다. 언제든 해지 가능합니다.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-foreground">
          <li>✓ 개인화 스트렝스 루틴 무제한 생성</li>
          <li>✓ e1RM 자동 추정 및 추천 중량</li>
          <li>✓ 탑세트 + 백오프 추천 시스템</li>
          <li>✓ 운동 기록 / 캘린더 / 통계</li>
          <li>✓ 코치 매칭 및 Q&A 게시판 이용</li>
        </ul>
      </section>

      <section className={`mt-4 rounded-2xl border p-5 ${expired ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
        <div className="text-xs text-muted-foreground">현재 상태</div>
        <div className="mt-1 text-xl font-bold">
          {info ? STATUS_LABEL[info.status] : "확인 중…"}
        </div>
        {row && (
          <div className="mt-3 space-y-1 text-sm text-muted-foreground">
            <div>무료체험 시작: {new Date(row.trial_started_at).toLocaleDateString("ko-KR")}</div>
            <div>무료체험 종료: {new Date(row.trial_ends_at).toLocaleDateString("ko-KR")}</div>
            {info && info.isAllowed && info.status === "trialing" && (
              <div className="text-foreground">
                남은 일수: <b className="text-primary">{Math.max(info.daysLeft, 0)}일</b>
              </div>
            )}
          </div>
        )}
      </section>

      {expired ? (
        <button
          className="mt-6 w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground active:scale-[0.98]"
          onClick={() => toast.info("결제 시스템 연동 준비 중입니다. 곧 출시됩니다!")}
        >
          월 38,000원 결제하고 계속 이용하기
        </button>
      ) : (
        <button
          className="mt-6 w-full rounded-xl border-2 border-primary/60 bg-primary/10 py-4 text-base font-bold text-primary active:scale-[0.98]"
          onClick={() => toast.info("결제 시스템 연동 준비 중입니다. 곧 출시됩니다!")}
        >
          지금 정기결제 신청하기 (월 38,000원)
        </button>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          onClick={() => nav({ to: "/profile" })}
          className="rounded-xl border border-primary/40 py-3 text-sm font-bold text-primary"
        >
          프로필로 이동
        </button>
        <Link
          to="/board"
          className="rounded-xl border border-border py-3 text-center text-sm font-bold"
        >
          공지/게시판
        </Link>
      </div>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          nav({ to: "/login", replace: true });
        }}
        className="mt-4 w-full rounded-xl border border-destructive/40 py-3 text-sm text-destructive"
      >
        로그아웃
      </button>
    </div>
  );
}
