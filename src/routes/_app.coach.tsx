import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TopBar } from "@/components/TopBar";
import { AlertTriangle, Trophy, Users } from "lucide-react";

export const Route = createFileRoute("/_app/coach")({
  component: CoachDashboard,
});

interface Athlete {
  id: string;
  name: string;
  sport: string | null;
}
interface Risk {
  athlete: Athlete;
  type: "overtraining" | "stagnation" | "low_completion";
  message: string;
}
interface UpcomingComp {
  id: string;
  competition_name: string;
  competition_date: string;
  importance: string;
  daysUntil: number;
}

function CoachDashboard() {
  const { user } = useAuth();
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [comps, setComps] = useState<UpcomingComp[]>([]);
  const [teamAvgFatigue, setTeamAvgFatigue] = useState<number | null>(null);
  const [teamCompletion, setTeamCompletion] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // teams I coach
      const { data: teams } = await supabase.from("teams").select("id").eq("coach_id", user.id);
      const teamIds = (teams ?? []).map((t) => t.id);
      if (teamIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data: members } = await supabase
        .from("team_members")
        .select("athlete_id")
        .in("team_id", teamIds)
        .eq("is_active", true);
      const athleteIds = Array.from(new Set((members ?? []).map((m) => m.athlete_id)));
      if (athleteIds.length === 0) {
        setLoading(false);
        return;
      }
      const { data: profs } = await supabase.from("profiles").select("id,name,sport").in("id", athleteIds);
      const map = new Map((profs ?? []).map((p) => [p.id, p as Athlete]));
      setAthletes(profs as Athlete[]);

      // Recent checkins (last 30d)
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select("athlete_id,fatigue_level,date")
        .in("athlete_id", athleteIds)
        .gte("date", since.toISOString().slice(0, 10))
        .order("date", { ascending: false });

      // team avg fatigue
      const fats = (checkins ?? []).map((c) => c.fatigue_level);
      setTeamAvgFatigue(fats.length ? Math.round((fats.reduce((a, b) => a + b, 0) / fats.length) * 10) / 10 : null);

      // risks: 5 consecutive days of fatigue >= 4
      const byAth: Record<string, { date: string; fatigue: number }[]> = {};
      (checkins ?? []).forEach((c) => {
        (byAth[c.athlete_id] ??= []).push({ date: c.date, fatigue: c.fatigue_level });
      });
      const newRisks: Risk[] = [];
      Object.entries(byAth).forEach(([aid, arr]) => {
        const last5 = arr.slice(0, 5);
        if (last5.length === 5 && last5.every((x) => x.fatigue >= 4)) {
          const a = map.get(aid);
          if (a) newRisks.push({ athlete: a, type: "overtraining", message: "5일 연속 피로도 4+ — 과훈련 의심" });
        }
      });

      // completion (1주)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: logs } = await supabase
        .from("workout_logs")
        .select("athlete_id,completed,skipped,date")
        .in("athlete_id", athleteIds)
        .gte("date", weekAgo.toISOString().slice(0, 10));
      const compByAth: Record<string, { done: number; total: number }> = {};
      (logs ?? []).forEach((l) => {
        const s = (compByAth[l.athlete_id] ??= { done: 0, total: 0 });
        s.total++;
        if (l.completed) s.done++;
      });
      let teamDone = 0,
        teamTotal = 0;
      Object.entries(compByAth).forEach(([aid, s]) => {
        teamDone += s.done;
        teamTotal += s.total;
        if (s.total > 0 && s.done / s.total < 0.5) {
          const a = map.get(aid);
          if (a) newRisks.push({ athlete: a, type: "low_completion", message: `1주 완료율 ${Math.round((s.done / s.total) * 100)}% — 면담 필요` });
        }
      });
      setTeamCompletion(teamTotal ? Math.round((teamDone / teamTotal) * 100) : null);

      // stagnation: e1RM unchanged for 3 weeks
      const { data: lifts } = await supabase
        .from("athlete_lifts")
        .select("athlete_id,lift_type,e1rm,recorded_date")
        .in("athlete_id", athleteIds)
        .order("recorded_date", { ascending: false });
      const liftByAth: Record<string, Record<string, { e: number; d: string }[]>> = {};
      (lifts ?? []).forEach((l) => {
        const ax = (liftByAth[l.athlete_id] ??= {});
        (ax[l.lift_type] ??= []).push({ e: Number(l.e1rm), d: l.recorded_date });
      });
      const threeWeeksAgo = new Date();
      threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);
      Object.entries(liftByAth).forEach(([aid, byLift]) => {
        const stagnantLifts = Object.entries(byLift).filter(([, hist]) => {
          if (hist.length < 2) return false;
          const newest = hist[0];
          const old = hist.find((h) => new Date(h.d) <= threeWeeksAgo);
          return old && newest.e <= old.e;
        });
        if (stagnantLifts.length >= 2) {
          const a = map.get(aid);
          if (a) newRisks.push({ athlete: a, type: "stagnation", message: "3주째 e1RM 정체 — 프로그램 변경 검토" });
        }
      });
      setRisks(newRisks);

      // upcoming comps
      const today = new Date();
      const { data: cps } = await supabase
        .from("competitions")
        .select("id,competition_name,competition_date,importance")
        .or(`athlete_id.in.(${athleteIds.join(",")}),team_id.in.(${teamIds.join(",")})`)
        .gte("competition_date", today.toISOString().slice(0, 10))
        .order("competition_date", { ascending: true })
        .limit(5);
      setComps(
        (cps ?? []).map((c) => ({
          ...c,
          daysUntil: Math.ceil((new Date(c.competition_date).getTime() - today.getTime()) / 86400000),
        })) as UpcomingComp[],
      );

      setLoading(false);
    })();
  }, [user]);

  return (
    <>
      <TopBar title="코치 대시보드" />
      <div className="container-mobile pb-24 pt-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : (
          <>
            {/* Team summary */}
            <div className="grid grid-cols-3 gap-2">
              <Stat label="선수" value={athletes.length.toString()} icon={<Users size={14} />} />
              <Stat label="평균 피로" value={teamAvgFatigue?.toString() ?? "—"} />
              <Stat label="1주 완료율" value={teamCompletion !== null ? `${teamCompletion}%` : "—"} />
            </div>

            {/* Risks */}
            <h2 className="mt-6 mb-2 flex items-center gap-1 text-sm font-bold">
              <AlertTriangle size={14} className="text-destructive" /> 위험 신호
            </h2>
            {risks.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">감지된 위험 신호가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {risks.map((r, i) => (
                  <div key={i} className="rounded-xl border border-destructive/40 bg-destructive/15 p-3 text-sm text-white">
                    <div className="font-bold">{r.athlete.name}</div>
                    <div className="mt-0.5 text-xs">{r.message}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming comps */}
            <h2 className="mt-6 mb-2 flex items-center gap-1 text-sm font-bold">
              <Trophy size={14} className="text-competition" /> 다가오는 시합
            </h2>
            {comps.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">예정된 시합이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {comps.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{c.competition_name}</span>
                      <span className="num text-competition">D-{c.daysUntil}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {c.competition_date} · 중요도 {c.importance}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="num mt-1 text-xl text-primary">{value}</div>
    </div>
  );
}
