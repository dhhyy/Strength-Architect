import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { LIFT_TYPES, LIFT_LABELS, type LiftType } from "@/lib/types";
import { calculateE1RM } from "@/lib/calc";
import { toast } from "sonner";
import { PageLoading } from "@/components/PageLoading";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

interface LiftInput {
  weight: string;
  reps: string;
}

function OnboardingPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [bodyweight, setBodyweight] = useState(0);
  const [inputs, setInputs] = useState<Record<LiftType, LiftInput>>(() =>
    Object.fromEntries(LIFT_TYPES.map((l) => [l, { weight: "", reps: "" }])) as Record<
      LiftType,
      LiftInput
    >,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: profile }, { data: lifts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("bodyweight")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("athlete_lifts")
          .select("lift_type, weight_lifted, reps")
          .eq("athlete_id", user.id)
          .eq("is_current", true),
      ]);
      if (cancelled) return;
      setBodyweight(Number(profile?.bodyweight) || 0);
      if ((lifts ?? []).length > 0) {
        setInputs((current) => {
          const next = { ...current };
          for (const lift of lifts ?? []) {
            const liftType = lift.lift_type as LiftType;
            if (liftType in next) {
              next[liftType] = {
                weight: String(lift.weight_lifted ?? ""),
                reps: String(lift.reps ?? ""),
              };
            }
          }
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading) return <PageLoading title="7대 리프트 입력" message="기록 불러오는 중" />;
  if (!user) return <Navigate to="/login" replace />;

  function update(lift: LiftType, key: keyof LiftInput, v: string) {
    setInputs((s) => ({ ...s, [lift]: { ...s[lift], [key]: v } }));
  }

  function preview(lift: LiftType): number | null {
    const w = parseFloat(inputs[lift].weight);
    const r = parseInt(inputs[lift].reps);
    if (inputs[lift].weight.trim() === "" || !r) return null;
    return calculateE1RM(w, r, lift, bodyweight);
  }

  async function handleSave() {
    if (!user) return;
    const rows = LIFT_TYPES.map((lift) => {
      const w = parseFloat(inputs[lift].weight);
      const r = parseInt(inputs[lift].reps);
      if (inputs[lift].weight.trim() === "" || Number.isNaN(w) || !r || w < 0 || r < 1 || r > 20) return null;
      return {
        athlete_id: user.id,
        lift_type: lift,
        weight_lifted: w,
        reps: r,
        e1rm: calculateE1RM(w, r, lift, bodyweight),
        is_current: true,
      };
    }).filter(Boolean) as any[];

    if (rows.length < 7) {
      toast.error("7개 모두 입력해 주세요");
      return;
    }
    setSaving(true);
    // mark old as not current
    const { error: updateError } = await supabase
      .from("athlete_lifts")
      .update({ is_current: false })
      .eq("athlete_id", user.id)
      .eq("is_current", true);
    if (updateError) {
      setSaving(false);
      toast.error(updateError.message);
      return;
    }
    const { error } = await supabase.from("athlete_lifts").insert(rows);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("저장 완료");
    nav({ to: "/templates", replace: true });
  }

  return (
    <div className="container-mobile py-10 pb-32">
      <h1 className="num text-3xl text-primary">7대 리프트 입력</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        실제 들었던 무게와 반복수를 입력하세요. e1RM이 자동 계산됩니다.
      </p>

      <div className="mt-8 space-y-4">
        {LIFT_TYPES.map((lift) => {
          const p = preview(lift);
          const r = parseInt(inputs[lift].reps);
          return (
            <div key={lift} className="rounded-2xl border border-border bg-card p-4">
              <div className="font-bold text-lg">
                {LIFT_LABELS[lift]}
                {(lift === "pullup" || lift === "dips") && (
                  <span className="ml-2 text-xs text-muted-foreground">(추가 무게)</span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="무게(kg)"
                  value={inputs[lift].weight}
                  onChange={(e) => update(lift, "weight", e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary"
                />
                <input
                  type="number"
                  min="1"
                  max="20"
                  placeholder="반복"
                  value={inputs[lift].reps}
                  onChange={(e) => update(lift, "reps", e.target.value)}
                  className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary"
                />
              </div>
              {p !== null && (
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground">예상 e1RM</span>
                  <span className="num text-2xl text-primary">{p}</span>
                  <span className="text-sm text-muted-foreground">kg</span>
                </div>
              )}
              {r >= 12 && (
                <p className="mt-2 text-xs text-warning">
                  ⚠ 반복 12회 이상은 정확도가 낮아질 수 있어요
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="container-mobile">
          <button
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-xl bg-primary py-4 font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "저장 중…" : "모두 입력 완료 → 루틴 만들기"}
          </button>
        </div>
      </div>
    </div>
  );
}
