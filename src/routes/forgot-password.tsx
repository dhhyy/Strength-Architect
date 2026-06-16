import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("재설정 메일을 보냈어요");
  }

  return (
    <div className="container-mobile flex min-h-screen flex-col justify-center py-12">
      <h1 className="text-2xl font-bold text-primary">비밀번호 찾기</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        가입한 이메일을 입력하면 재설정 링크를 보내드려요.
      </p>
      {sent ? (
        <div className="mt-6 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
          <p className="font-semibold text-primary">메일 발송 완료</p>
          <p className="mt-1 text-muted-foreground">
            메일함을 확인하고 링크를 눌러 새 비밀번호를 설정해 주세요. 메일이 안 보이면 스팸함도 확인해 보세요.
          </p>
        </div>
      ) : (
        <form onSubmit={handle} className="mt-6 space-y-3">
          <input
            required
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
          />
          <button
            disabled={loading}
            className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "발송 중…" : "재설정 메일 보내기"}
          </button>
        </form>
      )}
      <Link to="/login" className="mt-6 block text-center text-sm text-muted-foreground">
        로그인으로 돌아가기
      </Link>
    </div>
  );
}
