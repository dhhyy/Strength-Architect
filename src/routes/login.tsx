import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) nav({ to: "/", replace: true });
  }, [user, nav]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else nav({ to: "/", replace: true });
  }

  async function handleDemoLogin() {
    setLoading(true);
    const demoEmail = "demo@bstrength.app";
    const demoPassword = "demo-bstrength-2026";
    let { error } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: demoPassword,
    });
    if (error) {
      const { error: signUpError } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
          data: { name: "데모 사용자" },
        },
      });
      if (signUpError && !signUpError.message.toLowerCase().includes("registered")) {
        toast.error(signUpError.message);
        setLoading(false);
        return;
      }
      const retry = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });
      error = retry.error;
    }
    setLoading(false);
    if (error) toast.error(error.message);
    else nav({ to: "/", replace: true });
  }

  return (
    <div className="container-mobile flex min-h-screen flex-col justify-center py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-primary">비스트렝스</h1>
        <p className="mt-3 text-sm text-muted-foreground">운동선수 스트렝스 개인화 루틴앱</p>
      </div>
      <form onSubmit={handleLogin} className="space-y-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 text-base outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-4 text-base font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading}
        className="mt-3 w-full rounded-xl border-2 border-primary/60 bg-primary/5 py-4 text-base font-bold text-primary active:scale-[0.98] disabled:opacity-50"
      >
        체험용 데모 계정으로 둘러보기
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        회원가입 없이 바로 앱을 체험해볼 수 있습니다
      </p>

      <Link
        to="/forgot-password"
        className="mt-4 block text-center text-sm text-muted-foreground hover:text-primary"
      >
        비밀번호를 잊으셨나요?
      </Link>
      <Link
        to="/signup"
        className="mt-3 block text-center text-sm text-muted-foreground"
      >
        계정이 없으신가요? <span className="text-primary font-semibold">회원가입</span>
      </Link>
    </div>
  );
}
