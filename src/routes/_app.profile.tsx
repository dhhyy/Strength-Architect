import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { E1RM_TREND_LIFTS, LIFT_TYPES, LIFT_LABELS, LIFT_COLORS, type LiftType } from "@/lib/types";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AnnouncementsCard } from "@/components/AnnouncementsCard";
import { fetchSubscription, STATUS_LABEL, type SubscriptionInfo } from "@/lib/subscription";

function E1RMTrend({ athleteId }: { athleteId: string }) {
  const [period, setPeriod] = useState<1 | 3 | 6 | 0>(3);
  const [visible, setVisible] = useState<Record<string, boolean>>(
    Object.fromEntries(E1RM_TREND_LIFTS.map((l) => [l, true])),
  );
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      let q = supabase
        .from("athlete_lifts")
        .select("lift_type,e1rm,recorded_date")
        .eq("athlete_id", athleteId);
      if (period > 0) {
        const since = new Date();
        since.setMonth(since.getMonth() - period);
        q = q.gte("recorded_date", since.toISOString().slice(0, 10));
      }
      const { data: lifts } = await q
        .in("lift_type", [...E1RM_TREND_LIFTS])
        .order("recorded_date", { ascending: true });
      const byDate: Record<string, any> = {};
      (lifts ?? []).forEach((l: any) => {
        (byDate[l.recorded_date] ??= { date: l.recorded_date })[l.lift_type] = Number(l.e1rm);
      });
      setData(Object.values(byDate));
    })();
  }, [athleteId, period]);

  return (
    <section className="mt-8">
      <h2 className="mb-3 font-bold">e1RM 변화 추이</h2>
      <div className="mb-2 flex gap-1 text-xs">
        {[1, 3, 6, 0].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p as any)}
            className={`rounded-full px-3 py-1 ${period === p ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
          >
            {p === 0 ? "전체" : `${p}개월`}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-3" style={{ height: 240 }}>
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            아직 기록이 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid stroke="#222" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #333" }} />
              {E1RM_TREND_LIFTS.map(
                (l) =>
                  visible[l] && (
                    <Line key={l} type="monotone" dataKey={l} stroke={LIFT_COLORS[l]} dot={false} strokeWidth={2} />
                  ),
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {E1RM_TREND_LIFTS.map((l) => (
          <button
            key={l}
            onClick={() => setVisible({ ...visible, [l]: !visible[l] })}
            className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${
              visible[l] ? "border-border" : "border-border opacity-40"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: LIFT_COLORS[l] }} />
            {LIFT_LABELS[l]}
          </button>
        ))}
      </div>
    </section>
  );
}

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [sport, setSport] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [bw, setBw] = useState("");
  const [e1rms, setE1rms] = useState<Record<string, { id?: string; e1rm: number; weight: number; reps: number }>>({});
  const [activeName, setActiveName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string>("athlete");
  const [coachTeams, setCoachTeams] = useState<{ id: string; team_name: string; sport: string | null; member_count: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<{
    season_phase: string;
    sport_training_load: string;
    desired_lifting_days: number;
    preferred_lifting_weekdays: number[];
    priority_lifts: string[];
  }>({
    season_phase: "offseason",
    sport_training_load: "medium",
    desired_lifting_days: 4,
    preferred_lifting_weekdays: [1, 3, 5],
    priority_lifts: [],
  });
  const [editLift, setEditLift] = useState<LiftType | null>(null);
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchSubscription(user.id).then(setSub);
  }, [user]);

  async function loadAll() {
    if (!user) return;
    const [p, a, lifts] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("athlete_active_template")
        .select("routine_templates(template_name)")
        .eq("athlete_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("athlete_lifts")
        .select("id, lift_type, e1rm, weight_lifted, reps")
        .eq("athlete_id", user.id)
        .eq("is_current", true),
    ]);
    if (p.data) {
      setName(p.data.name ?? "");
      setSport(p.data.sport ?? "");
      setGender(((p.data as any).gender as "male" | "female") ?? "");
      setAge((p.data as any).age != null ? String((p.data as any).age) : "");
      setHeightCm((p.data as any).height_cm != null ? String((p.data as any).height_cm) : "");
      setBw(p.data.bodyweight ? String(p.data.bodyweight) : "");
      setIsAdmin(!!(p.data as any).is_admin);
      setRole((p.data as any).role ?? "athlete");
    }
    // load routine preferences
    const { data: prefData } = await supabase
      .from("athlete_preferences")
      .select("*")
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (prefData) {
      setPrefs({
        season_phase: (prefData as any).season_phase ?? "offseason",
        sport_training_load: (prefData as any).sport_training_load ?? "medium",
        desired_lifting_days: (prefData as any).desired_lifting_days ?? 4,
        preferred_lifting_weekdays: (prefData as any).preferred_lifting_weekdays ?? [1, 3, 5],
        priority_lifts: (prefData as any).priority_lifts ?? [],
      });
    }
    setActiveName((a.data as any)?.routine_templates?.template_name ?? null);
    const map: Record<string, any> = {};
    (lifts.data ?? []).forEach((l: any) => {
      map[l.lift_type] = {
        id: l.id,
        e1rm: Number(l.e1rm),
        weight: Number(l.weight_lifted),
        reps: l.reps,
      };
    });
    setE1rms(map);

    // Coach: load own teams + member counts
    if ((p.data as any)?.role === "coach") {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, team_name, sport")
        .eq("coach_id", user.id);
      const teamList = teams ?? [];
      const counts: Record<string, number> = {};
      if (teamList.length) {
        const { data: members } = await supabase
          .from("team_members")
          .select("team_id")
          .in("team_id", teamList.map((t) => t.id))
          .eq("is_active", true);
        (members ?? []).forEach((m: any) => {
          counts[m.team_id] = (counts[m.team_id] ?? 0) + 1;
        });
      }
      setCoachTeams(teamList.map((t) => ({ ...t, member_count: counts[t.id] ?? 0 })));
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);




  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        sport: sport || null,
        gender: gender || null,
        age: age ? parseInt(age) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        bodyweight: bw ? parseFloat(bw) : null,
      } as any)
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("프로필 저장됨");
  }

  async function savePrefs() {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const { error } = await supabase.from("athlete_preferences").upsert(
        {
          athlete_id: user.id,
          season_phase: prefs.season_phase,
          sport_training_load: prefs.sport_training_load,
          desired_lifting_days: prefs.desired_lifting_days,
          preferred_lifting_weekdays: prefs.preferred_lifting_weekdays,
          priority_lifts: prefs.priority_lifts,
        } as any,
        { onConflict: "athlete_id" },
      );
      if (error) throw error;

      // Rebuild current assigned routine snapshot so new preferences apply
      // to future (uncompleted) workouts. Past workout_logs/daily_routines are untouched.
      const { data: assignment } = await supabase
        .from("athlete_routine_assignments")
        .select("id, source_template_id")
        .eq("athlete_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (assignment?.source_template_id) {
        const { buildSnapshot, buildWeekdayMap } = await import("@/lib/routine-engine");
        const { data: days } = await supabase
          .from("template_days")
          .select("id, day_of_week, week_number, is_rest_day, day_title")
          .eq("template_id", assignment.source_template_id)
          .order("week_number")
          .order("day_of_week");
        const daysList = (days ?? []) as any[];
        const dayIds = daysList.map((d) => d.id);
        const { data: exs } = dayIds.length
          ? await supabase
              .from("template_exercises")
              .select("*")
              .in("template_day_id", dayIds)
              .order("order_index")
          : { data: [] as any[] };
        const week1 = daysList.filter((d) => d.week_number === 1 && !d.is_rest_day);
        const weekdayMap = buildWeekdayMap(
          prefs.preferred_lifting_weekdays,
          week1.map((d) => d.day_of_week),
        );
        const snapshot = buildSnapshot(daysList, (exs ?? []) as any[], {
          season_phase: prefs.season_phase as any,
          sport_training_load: prefs.sport_training_load as any,
          desired_lifting_days: prefs.desired_lifting_days,
          preferred_lifting_weekdays: prefs.preferred_lifting_weekdays,
          priority_lifts: prefs.priority_lifts as any,
        });
        await supabase
          .from("athlete_routine_assignments")
          .update({
            weekday_map: weekdayMap as any,
            snapshot: snapshot as any,
            priority_lifts: prefs.priority_lifts,
          } as any)
          .eq("id", assignment.id);
      }

      toast.success("루틴 선호가 저장되었습니다. 다음 미완료 세션부터 반영됩니다.");
    } catch (e: any) {
      toast.error(e.message ?? "저장 실패");
    } finally {
      setSavingPrefs(false);
    }
  }


  async function saveLift(lift: LiftType, weight: number, reps: number) {
    if (!user) return;
    const e1rm = Math.round(weight * (1 + reps / 30) * 10) / 10;
    // Mark previous as not current
    await supabase
      .from("athlete_lifts")
      .update({ is_current: false })
      .eq("athlete_id", user.id)
      .eq("lift_type", lift)
      .eq("is_current", true);
    const { error } = await supabase.from("athlete_lifts").insert({
      athlete_id: user.id,
      lift_type: lift,
      weight_lifted: weight,
      reps,
      e1rm,
      is_current: true,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`${LIFT_LABELS[lift]} e1RM ${e1rm}kg 저장`);
    setEditLift(null);
    await loadAll();
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/login", replace: true });
  }

  const isCoach = role === "coach";

  return (
    <div className="container-mobile py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold text-primary">프로필</h1>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isCoach ? "bg-warning/20 text-warning" : "bg-primary/20 text-primary"}`}>
          {isCoach ? "코치" : "선수"}
        </span>
      </div>

      <div className="mt-6">
        <AnnouncementsCard />
      </div>

      {/* Subscription card */}
      {sub?.row && (
        <section className={`mt-4 rounded-2xl border p-4 ${sub.isAllowed ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">구독 상태</div>
              <div className="mt-1 text-lg font-bold">{STATUS_LABEL[sub.status]}</div>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div>무료체험 시작: {new Date(sub.row.trial_started_at).toLocaleDateString("ko-KR")}</div>
                <div>무료체험 종료: {new Date(sub.row.trial_ends_at).toLocaleDateString("ko-KR")}</div>
                {sub.isAllowed && sub.status === "trialing" && (
                  <div className="text-primary font-semibold">남은 일수: {Math.max(sub.daysLeft, 0)}일</div>
                )}
              </div>
            </div>
            <button
              onClick={() => nav({ to: "/subscribe" })}
              className="shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              상세
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">결제 기능은 곧 추가될 예정입니다.</p>
        </section>
      )}

      {/* Basic info */}
      <section className="mt-6 space-y-3">
        <Field label="이름" value={name} onChange={setName} />
        <Field label="종목" value={sport} onChange={setSport} placeholder="예: 역도, 크로스핏" />
        <div>
          <div className="mb-1 text-xs text-muted-foreground">성별</div>
          <div className="grid grid-cols-2 gap-2">
            {(["male", "female"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`rounded-lg border py-3 text-sm font-semibold ${
                  gender === g ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground"
                }`}
              >
                {g === "male" ? "남" : "여"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="나이" value={age} onChange={setAge} type="number" />
          <Field label="키 (cm)" value={heightCm} onChange={setHeightCm} type="number" />
          <Field label="체중 (kg)" value={bw} onChange={setBw} type="number" />
        </div>
        <button
          onClick={saveProfile}
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "저장 중…" : "프로필 저장"}
        </button>
      </section>

      {!isCoach && (
        <>
          {/* e1RM 표시/추이는 /records 로 이동 — 프로필에서는 제거 */}


          {/* Active routine */}
          <section className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="text-xs text-muted-foreground">현재 루틴</div>
            <div className="mt-1 text-lg font-bold">{activeName ?? "없음"}</div>
            <button
              onClick={() => nav({ to: "/templates" })}
              className="mt-4 w-full rounded-xl border border-primary/40 py-3 font-bold text-primary"
            >
              루틴 다시 만들기
            </button>
          </section>

          {/* Routine preferences */}
          <section className="mt-6 rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-bold">루틴 선호 설정</h2>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">시즌 상태</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "offseason", label: "비시즌기" },
                  { v: "inseason", label: "시즌기" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setPrefs((p) => ({ ...p, season_phase: o.v }))}
                    className={`rounded-lg border-2 py-2 text-sm ${prefs.season_phase === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">종목 훈련 부담</div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { v: "low", label: "낮음" },
                  { v: "medium", label: "보통" },
                  { v: "high", label: "높음" },
                  { v: "very_high", label: "매우 높음" },
                ].map((o) => (
                  <button
                    key={o.v}
                    onClick={() => setPrefs((p) => ({ ...p, sport_training_load: o.v }))}
                    className={`rounded-lg border-2 py-2 text-xs ${prefs.sport_training_load === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">주당 웨이트 희망 일수</div>
              <div className="grid grid-cols-4 gap-1">
                {[3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPrefs((p) => ({ ...p, desired_lifting_days: d }))}
                    className={`rounded-lg border-2 py-2 text-sm ${prefs.desired_lifting_days === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                  >
                    주{d}일
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">선호 웨이트 요일</div>
              <div className="grid grid-cols-7 gap-1">
                {[
                  { v: 1, label: "월" }, { v: 2, label: "화" }, { v: 3, label: "수" },
                  { v: 4, label: "목" }, { v: 5, label: "금" }, { v: 6, label: "토" }, { v: 0, label: "일" },
                ].map((d) => {
                  const on = prefs.preferred_lifting_weekdays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      onClick={() => setPrefs((p) => ({
                        ...p,
                        preferred_lifting_weekdays: on
                          ? p.preferred_lifting_weekdays.filter((x) => x !== d.v)
                          : [...p.preferred_lifting_weekdays, d.v].sort(),
                      }))}
                      className={`rounded-lg border-2 py-2 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted-foreground">중요 운동 (최대 3개)</div>
              <div className="grid grid-cols-2 gap-1">
                {LIFT_TYPES.map((l) => {
                  const on = prefs.priority_lifts.includes(l);
                  return (
                    <button
                      key={l}
                      onClick={() => setPrefs((p) => {
                        if (on) return { ...p, priority_lifts: p.priority_lifts.filter((x) => x !== l) };
                        if (p.priority_lifts.length >= 3) { toast.error("최대 3개"); return p; }
                        return { ...p, priority_lifts: [...p.priority_lifts, l] };
                      })}
                      className={`rounded-lg border-2 py-2 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {LIFT_LABELS[l]}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={savePrefs}
              disabled={savingPrefs}
              className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50"
            >
              {savingPrefs ? "저장 중…" : "루틴 선호 저장"}
            </button>
          </section>
        </>
      )}

      {isCoach && (
        <>
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">내가 지도하는 팀</h2>
              <button
                onClick={() => nav({ to: "/coach/team" })}
                className="rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary"
              >
                팀 관리
              </button>
            </div>
            {coachTeams.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                아직 팀이 없습니다. 팀 관리에서 추가하세요.
              </div>
            ) : (
              <div className="space-y-2">
                {coachTeams.map((t) => (
                  <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold">{t.team_name}</div>
                        <div className="text-xs text-muted-foreground">{t.sport ?? "종목 미지정"}</div>
                      </div>
                      <div className="text-right">
                        <div className="num text-2xl text-primary">{t.member_count}</div>
                        <div className="text-[10px] text-muted-foreground">선수</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 grid grid-cols-2 gap-2">
            <button
              onClick={() => nav({ to: "/coach" })}
              className="rounded-xl border border-primary/40 py-3 text-sm font-bold text-primary"
            >
              코치 대시보드
            </button>
            <button
              onClick={() => nav({ to: "/coach/templates" })}
              className="rounded-xl border border-primary/40 py-3 text-sm font-bold text-primary"
            >
              루틴 배정
            </button>
          </section>
        </>
      )}

      {isAdmin && (
        <button
          onClick={() => nav({ to: "/admin" })}
          className="mt-4 w-full rounded-xl border py-3 font-bold"
          style={{ borderColor: "#FFD700", color: "#FFD700" }}
        >
          👑 관리자 · 템플릿 업로드
        </button>
      )}


      <button
        onClick={signOut}
        className="mt-8 w-full rounded-xl border border-destructive/40 py-3 text-destructive"
      >
        로그아웃
      </button>

      {editLift && (
        <LiftEditModal
          lift={editLift}
          initial={e1rms[editLift] ?? { e1rm: 0, weight: 0, reps: 5 }}
          onClose={() => setEditLift(null)}
          onSave={(w, r) => saveLift(editLift, w, r)}
        />
      )}
    </div>
  );
}

function LiftEditModal({
  lift,
  initial,
  onClose,
  onSave,
}: {
  lift: LiftType;
  initial: { weight: number; reps: number };
  onClose: () => void;
  onSave: (weight: number, reps: number) => void;
}) {
  const [w, setW] = useState(initial.weight ? String(initial.weight) : "");
  const [r, setR] = useState(initial.reps ? String(initial.reps) : "5");
  const preview = useMemo(() => {
    const wn = parseFloat(w);
    const rn = parseInt(r);
    if (!wn || !rn) return null;
    return Math.round(wn * (1 + rn / 30) * 10) / 10;
  }, [w, r]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-5">
        <h3 className="text-lg font-bold">{LIFT_LABELS[lift]} 기록 입력</h3>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">무게(kg)</div>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              value={w}
              onChange={(e) => setW(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-3 text-center outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs text-muted-foreground">반복</div>
            <input
              type="number"
              inputMode="numeric"
              value={r}
              onChange={(e) => setR(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-3 text-center outline-none focus:border-primary"
            />
          </label>
        </div>
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-center">
          <div className="text-xs text-muted-foreground">예상 1RM</div>
          <div className="mt-1 text-2xl font-bold text-primary">
            {preview != null ? `${preview} kg` : "—"}
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3">취소</button>
          <button
            disabled={preview == null}
            onClick={() => onSave(parseFloat(w), parseInt(r))}
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary"
      />
    </label>
  );
}
