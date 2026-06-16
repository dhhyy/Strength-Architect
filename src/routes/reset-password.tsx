import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase redirect leaves a recovery session in the URL hash; the SDK
    // picks it up automatically. Verify a session exists before allowing change.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        toast.error("재설정 링크가 만료되었거나 잘못되었습니다. 다시 요청해 주세요.");
        nav({ to: "/forgot-password", replace: true });
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("비밀번호는 6자 이상이어야 합니다");
    if (password !== confirm) return toast.error("비밀번호가 일치하지 않습니다");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("비밀번호가 변경되었어요. 다시 로그인해 주세요.");
    await supabase.auth.signOut();
    nav({ to: "/login", replace: true });
  }

  if (!ready) {
    return <div className="p-8 text-muted-foreground">확인 중…</div>;
  }

  return (
    <div className="container-mobile flex min-h-screen flex-col justify-center py-12">
      <h1 className="text-2xl font-bold text-primary">새 비밀번호 설정</h1>
      <form onSubmit={handle} className="mt-6 space-y-3">
        <input
          required
          type="password"
          minLength={6}
          placeholder="새 비밀번호 (6자 이상)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />
        <input
          required
          type="password"
          minLength={6}
          placeholder="비밀번호 확인"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />
        <button
          disabled={loading}
          className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground disabled:opacity-50"
        >
          {loading ? "저장 중…" : "비밀번호 변경"}
        </button>
      </form>
      <Link to="/login" className="mt-6 block text-center text-sm text-muted-foreground">
        로그인으로 돌아가기
      </Link>
    </div>
  );
}
