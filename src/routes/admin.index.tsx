import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { SPLIT_LABELS, DIFFICULTY_LABELS } from "@/lib/types";
import { Plus, Edit3, Copy, Trash2, Search, ClipboardList, Megaphone } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
});

function AdminPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("routine_templates")
      .select("*")
      .order("created_at", { ascending: false });
    setTemplates(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createNew() {
    if (!user) return;
    const { data, error } = await supabase
      .from("routine_templates")
      .insert({
        template_name: "새 템플릿",
        description: "",
        split_type: "full_body_3",
        days_per_week: 3,
        duration_weeks: 8,
        difficulty_level: "beginner",
        is_public: true,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    nav({ to: "/admin/template/$id", params: { id: data.id } });
  }

  async function duplicate(t: any) {
    if (!user) return;
    const { data: nt, error } = await supabase
      .from("routine_templates")
      .insert({
        template_name: t.template_name + " (복사)",
        description: t.description,
        split_type: t.split_type,
        days_per_week: t.days_per_week,
        duration_weeks: t.duration_weeks,
        difficulty_level: t.difficulty_level,
        target_audience: t.target_audience,
        is_public: t.is_public,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const { data: days } = await supabase.from("template_days").select("*").eq("template_id", t.id);
    for (const d of days ?? []) {
      const { data: nd } = await supabase
        .from("template_days")
        .insert({
          template_id: nt.id,
          week_number: d.week_number,
          day_of_week: d.day_of_week,
          day_title: d.day_title,
          is_rest_day: d.is_rest_day,
        })
        .select()
        .single();
      if (!nd) continue;
      const { data: exs } = await supabase
        .from("template_exercises")
        .select("*")
        .eq("template_day_id", d.id);
      if (exs && exs.length) {
        await supabase.from("template_exercises").insert(
          exs.map((e: any) => ({
            template_day_id: nd.id,
            exercise_name: e.exercise_name,
            lift_type: e.lift_type,
            base_sets: e.base_sets,
            base_reps: e.base_reps,
            base_intensity_percent: e.base_intensity_percent,
            fixed_weight: e.fixed_weight,
            priority: e.priority,
            order_index: e.order_index,
            note: e.note,
          })),
        );
      }
    }
    toast.success("복제 완료");
    load();
  }

  async function remove(id: string) {
    if (!confirm("정말 삭제할까요?")) return;
    const { data: days } = await supabase.from("template_days").select("id").eq("template_id", id);
    if (days?.length) {
      await supabase
        .from("template_exercises")
        .delete()
        .in("template_day_id", days.map((d: any) => d.id));
      await supabase.from("template_days").delete().eq("template_id", id);
    }
    const { error } = await supabase.from("routine_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제됨");
    load();
  }

  async function togglePublish(t: any) {
    const next = !t.is_public;
    const { error } = await supabase
      .from("routine_templates")
      .update({ is_public: next })
      .eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "발행됨 (선수 노출)" : "비공개 처리됨");
    load();
  }

  return (
    <div className="container-mobile py-6 pb-24">
      <h1 className="text-2xl font-bold">
        <span style={{ color: "#FFD700" }}>🛠</span> 관리자 · 시스템 관리
      </h1>
      <button
        onClick={createNew}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
      >
        <Plus size={18} /> 새 템플릿 만들기
      </button>
      <Link
        to="/admin/exercises"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3 font-bold text-primary"
      >
        <Search size={18} /> 운동검색 라이브러리 관리
      </Link>
      <Link
        to="/admin/habits"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3 font-bold text-primary"
      >
        <ClipboardList size={18} /> 생활습관 추천관리
      </Link>
      <Link
        to="/admin/announcements"
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 py-3 font-bold text-primary"
      >
        <Megaphone size={18} /> 공지사항 관리
      </Link>

      <AdminSubscriptions />


      <div className="mt-6 space-y-3">
        {templates.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            템플릿이 없습니다
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold">{t.template_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {SPLIT_LABELS[t.split_type] ?? t.split_type} · 주{t.days_per_week}일 · {t.duration_weeks}주 ·{" "}
                  {DIFFICULTY_LABELS[t.difficulty_level]}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  t.is_public
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.is_public ? "발행됨" : "비공개"}
              </span>
            </div>
            {t.description && (
              <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
            )}
            <div className="mt-3 flex gap-2">
              <Link
                to="/admin/template/$id"
                params={{ id: t.id }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-primary/40 py-2 text-xs font-semibold text-primary"
              >
                <Edit3 size={14} /> 편집
              </Link>
              <button
                onClick={() => togglePublish(t)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs"
              >
                {t.is_public ? "비공개" : "발행"}
              </button>
              <button
                onClick={() => duplicate(t)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs"
              >
                <Copy size={14} /> 복제
              </button>
              <button
                onClick={() => remove(t.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/40 py-2 text-xs text-destructive"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminSubscriptions() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function findUserId(): Promise<string | null> {
    const { data } = await supabase
      .from("profiles")
      .select("id, name")
      .ilike("name", `%${email}%`)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
    setResult(`'${email}' 와 일치하는 사용자를 찾지 못했습니다 (이름으로 검색).`);
    return null;
  }

  async function extendTrial(days: number) {
    setBusy(true);
    setResult(null);
    const uid = await findUserId();
    if (!uid) return setBusy(false);
    const { data: cur } = (await supabase
      .from("user_subscriptions" as any)
      .select("trial_ends_at")
      .eq("user_id", uid)
      .maybeSingle()) as { data: { trial_ends_at: string } | null };
    const base = cur?.trial_ends_at ? new Date(cur.trial_ends_at) : new Date();
    if (base.getTime() < Date.now()) base.setTime(Date.now());
    base.setDate(base.getDate() + days);
    const { error } = await supabase
      .from("user_subscriptions" as any)
      .upsert({
        user_id: uid,
        trial_ends_at: base.toISOString(),
        subscription_status: "trialing",
      } as any, { onConflict: "user_id" });
    setBusy(false);
    setResult(error ? error.message : `${days}일 연장 완료 (새 종료일 ${base.toLocaleDateString("ko-KR")})`);
  }

  async function setStatus(status: "active" | "admin_override" | "expired") {
    setBusy(true);
    setResult(null);
    const uid = await findUserId();
    if (!uid) return setBusy(false);
    const { error } = await supabase
      .from("user_subscriptions" as any)
      .upsert({
        user_id: uid,
        subscription_status: status,
        is_admin_override: status === "admin_override",
        admin_override_reason: status === "admin_override" ? "manual" : null,
      } as any, { onConflict: "user_id" });
    setBusy(false);
    setResult(error ? error.message : `상태를 ${status}로 변경했습니다`);
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">구독/체험 관리</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        사용자 이름으로 검색 후 무료체험 연장 / 강제 활성화 / 관리자 승인을 적용합니다.
      </p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="사용자 이름 일부"
        className="mt-3 w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-primary"
      />
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <button disabled={busy || !email} onClick={() => extendTrial(7)} className="rounded-lg border border-primary/40 py-2 text-primary disabled:opacity-40">
          +7일 연장
        </button>
        <button disabled={busy || !email} onClick={() => extendTrial(30)} className="rounded-lg border border-primary/40 py-2 text-primary disabled:opacity-40">
          +30일 연장
        </button>
        <button disabled={busy || !email} onClick={() => setStatus("active")} className="rounded-lg border border-primary/40 py-2 text-primary disabled:opacity-40">
          강제 active
        </button>
        <button disabled={busy || !email} onClick={() => setStatus("admin_override")} className="rounded-lg border-2 py-2 disabled:opacity-40" style={{ borderColor: "#FFD700", color: "#FFD700" }}>
          관리자 승인 (무제한)
        </button>
        <button disabled={busy || !email} onClick={() => setStatus("expired")} className="col-span-2 rounded-lg border border-destructive/40 py-2 text-destructive disabled:opacity-40">
          만료 처리
        </button>
      </div>
      {result && (
        <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">{result}</p>
      )}
    </section>
  );
}
