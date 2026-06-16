import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bw, setBw] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (role === "athlete" && !gender) {
      toast.error("성별을 선택해 주세요");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { name },
      },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
      if (e2) {
        toast.error(e2.message);
        setLoading(false);
        return;
      }
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? data.user?.id;
    if (!userId) {
      toast.error("가입 세션을 확인하지 못했어요. 다시 로그인해 주세요.");
      setLoading(false);
      return;
    }
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        name: name.trim(),
        sport: sport.trim() || null,
        bodyweight: role === "athlete" ? parseFloat(bw) || null : null,
        age: role === "athlete" && age ? parseInt(age) : null,
        height_cm: role === "athlete" && heightCm ? parseFloat(heightCm) : null,
        gender: role === "athlete" ? gender || null : null,
        role,
      } as any,
      { onConflict: "id" },
    );
    if (profileError) {
      toast.error(profileError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    nav({ to: role === "coach" ? "/coach" : "/onboarding", replace: true });
  }

  return (
    <div className="container-mobile py-10 pb-16">
      <h1 className="num text-3xl text-primary">회원가입</h1>
      <p className="mt-1 text-sm text-muted-foreground">역할을 선택하세요</p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setRole("athlete")}
          className={`rounded-xl border-2 p-4 text-left transition ${
            role === "athlete" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
        >
          <div className="text-lg font-bold">🏃 선수</div>
          <div className="mt-1 text-xs text-muted-foreground">개인 훈련 / 루틴 관리</div>
        </button>
        <button
          type="button"
          onClick={() => setRole("coach")}
          className={`rounded-xl border-2 p-4 text-left transition ${
            role === "coach" ? "border-primary bg-primary/10" : "border-border bg-card"
          }`}
          style={role === "coach" ? { borderColor: "#FFD700", background: "rgba(255,215,0,0.08)" } : {}}
        >
          <div className="text-lg font-bold">👑 코치</div>
          <div className="mt-1 text-xs text-muted-foreground">팀 만들기 / 선수 관리</div>
        </button>
      </div>

      <form onSubmit={handle} className="mt-6 space-y-3">
        <input
          required type="text" placeholder="이름" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />
        <input
          type="text" placeholder={role === "coach" ? "종목 (선택)" : "종목 (예: 축구, 농구)"}
          required={role === "athlete"}
          value={sport} onChange={(e) => setSport(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />

        {role === "athlete" && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <input
                required type="number" min="10" max="80" placeholder="나이"
                value={age} onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
              />
              <input
                required type="number" step="0.1" min="100" max="230" placeholder="키 (cm)"
                value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
              />
            </div>
            <input
              required type="number" step="0.1" min="20" max="200" placeholder="체중 (kg)"
              value={bw} onChange={(e) => setBw(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
            />
            <div>
              <div className="mb-1 text-xs text-muted-foreground">성별</div>
              <div className="grid grid-cols-2 gap-2">
                {(["male", "female"] as const).map((g) => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGender(g)}
                    className={`rounded-xl border-2 py-3 text-sm font-semibold ${
                      gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {g === "male" ? "남" : "여"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <input
          required type="email" placeholder="이메일" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />
        <input
          required type="password" placeholder="비밀번호 (6자 이상)" minLength={6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-4 py-4 outline-none focus:border-primary"
        />

        <p className="rounded-lg bg-primary/10 px-3 py-3 text-sm leading-relaxed text-primary">
          가입 후 7일 동안 무료로 모든 기능을 사용할 수 있습니다.
        </p>
        <p className="rounded-lg bg-secondary/60 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
          이 정보는 추후 질문&답변을 위해 수집되며, 외부 유출되지 않습니다.
        </p>
        <button
          disabled={loading}
          className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "가입 중…" : role === "coach" ? "코치로 가입하기" : "다음: e1RM 입력"}
        </button>
      </form>
      <Link to="/login" className="mt-6 block text-center text-sm text-muted-foreground">
        이미 계정이 있나요? <span className="text-primary font-semibold">로그인</span>
      </Link>
    </div>
  );
}
