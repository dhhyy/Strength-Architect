import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { SPLIT_LABELS, DIFFICULTY_LABELS } from "@/lib/types";
import { CheckCircle2, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/coach/templates")({
  component: CoachTemplatesPage,
});

interface Template {
  id: string;
  template_name: string;
  description: string | null;
  split_type: string;
  days_per_week: number;
  duration_weeks: number;
  difficulty_level: string;
}
interface Athlete {
  id: string;
  name: string;
  sport: string | null;
  team_name: string;
  active_template_id: string | null;
}

function CoachTemplatesPage() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user]);

  async function load() {
    setLoading(true);
    const { data: tps } = await supabase
      .from("routine_templates")
      .select("*")
      .eq("is_public", true)
      .order("template_name");
    setTemplates((tps ?? []) as Template[]);

    const { data: teams } = await supabase
      .from("teams")
      .select("id,team_name")
      .eq("coach_id", user!.id);
    const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t.team_name as string]));
    const teamIds = (teams ?? []).map((t: any) => t.id);
    if (!teamIds.length) {
      setAthletes([]);
      setLoading(false);
      return;
    }
    const { data: tm } = await supabase
      .from("team_members")
      .select("team_id,athlete_id")
      .in("team_id", teamIds)
      .eq("is_active", true);
    const memberRows = (tm ?? []) as { team_id: string; athlete_id: string }[];
    const athleteIds = Array.from(new Set(memberRows.map((m) => m.athlete_id)));
    if (!athleteIds.length) {
      setAthletes([]);
      setLoading(false);
      return;
    }
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,name,sport")
      .in("id", athleteIds);
    const { data: active } = await supabase
      .from("athlete_active_template")
      .select("athlete_id,template_id,is_active")
      .in("athlete_id", athleteIds)
      .eq("is_active", true);
    const activeMap = new Map(
      (active ?? []).map((a: any) => [a.athlete_id, a.template_id as string]),
    );
    const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setAthletes(
      memberRows.map((m) => {
        const p: any = profMap.get(m.athlete_id) ?? { name: "?", sport: null };
        return {
          id: m.athlete_id,
          name: p.name,
          sport: p.sport,
          team_name: teamMap.get(m.team_id) ?? "",
          active_template_id: activeMap.get(m.athlete_id) ?? null,
        };
      }),
    );
    setLoading(false);
  }

  async function assign(athleteId: string, templateId: string) {
    // deactivate any current
    await supabase
      .from("athlete_active_template")
      .update({ is_active: false })
      .eq("athlete_id", athleteId)
      .eq("is_active", true);
    const { error } = await supabase.from("athlete_active_template").insert({
      athlete_id: athleteId,
      template_id: templateId,
      is_active: true,
      start_date: new Date().toISOString().slice(0, 10),
      current_week: 1,
    });
    if (error) return toast.error(error.message);
    toast.success("템플릿 배정 완료");
    setSelectedAthlete(null);
    load();
  }

  async function unassign(athleteId: string) {
    if (!confirm("배정을 해제할까요?")) return;
    const { error } = await supabase
      .from("athlete_active_template")
      .update({ is_active: false })
      .eq("athlete_id", athleteId)
      .eq("is_active", true);
    if (error) return toast.error(error.message);
    toast.success("해제됨");
    load();
  }

  const tplById = new Map(templates.map((t) => [t.id, t]));

  return (
    <>
      <TopBar title="루틴 배정" />
      <div className="container-mobile pb-24 pt-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : athletes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto mb-2" size={28} />
            팀에 선수가 없습니다. 먼저 선수관리에서 팀과 선수를 추가하세요.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              선수를 탭하여 템플릿을 배정하거나 변경하세요.
            </p>
            {athletes.map((a) => {
              const active = a.active_template_id ? tplById.get(a.active_template_id) : null;
              return (
                <button
                  key={a.id + a.team_name}
                  onClick={() => setSelectedAthlete(a)}
                  className="block w-full rounded-xl border border-border bg-card p-3 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{a.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.team_name}
                        {a.sport ? ` · ${a.sport}` : ""}
                      </div>
                    </div>
                    {active ? (
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-primary">
                          <CheckCircle2 size={12} /> 배정됨
                        </div>
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {active.template_name}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">미배정</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedAthlete && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
            onClick={() => setSelectedAthlete(null)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-bold">{selectedAthlete.name} 템플릿 배정</h3>
                <button
                  onClick={() => setSelectedAthlete(null)}
                  className="text-sm text-muted-foreground"
                >
                  닫기
                </button>
              </div>
              {selectedAthlete.active_template_id && (
                <button
                  onClick={() => unassign(selectedAthlete.id)}
                  className="mb-2 w-full rounded-lg border border-destructive/40 py-2 text-xs text-destructive"
                >
                  현재 배정 해제
                </button>
              )}
              <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    사용 가능한 템플릿이 없습니다.
                  </p>
                ) : (
                  templates.map((t) => {
                    const isActive = selectedAthlete.active_template_id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => assign(selectedAthlete.id, t.id)}
                        disabled={isActive}
                        className={`block w-full rounded-lg border p-3 text-left ${
                          isActive
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-semibold">{t.template_name}</div>
                          {isActive && (
                            <CheckCircle2 size={14} className="text-primary" />
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {SPLIT_LABELS[t.split_type] ?? t.split_type} · 주{t.days_per_week}일 ·{" "}
                          {t.duration_weeks}주 · {DIFFICULTY_LABELS[t.difficulty_level]}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
