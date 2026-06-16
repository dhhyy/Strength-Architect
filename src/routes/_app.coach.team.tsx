import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { TopBar } from "@/components/TopBar";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Users } from "lucide-react";

export const Route = createFileRoute("/_app/coach/team")({
  component: CoachTeamPage,
});

interface Team {
  id: string;
  team_name: string;
  sport: string | null;
  invite_code: string;
}
interface Member {
  id: string; // team_members.id
  athlete_id: string;
  is_active: boolean;
  profile: { id: string; name: string; sport: string | null } | null;
}

function CoachTeamPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("");
  const [showAddAthlete, setShowAddAthlete] = useState(false);
  const [demoName, setDemoName] = useState("");
  const [demoSport, setDemoSport] = useState("");

  useEffect(() => {
    if (!user) return;
    loadTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeamId) loadMembers(selectedTeamId);
  }, [selectedTeamId]);

  async function loadTeams() {
    setLoading(true);
    const { data } = await supabase
      .from("teams")
      .select("*")
      .eq("coach_id", user!.id)
      .order("created_at");
    const list = (data ?? []) as Team[];
    setTeams(list);
    if (list.length && !selectedTeamId) setSelectedTeamId(list[0].id);
    setLoading(false);
  }

  async function loadMembers(teamId: string) {
    const { data: tm } = await supabase
      .from("team_members")
      .select("id,athlete_id,is_active")
      .eq("team_id", teamId)
      .order("joined_at");
    const ids = (tm ?? []).map((m) => m.athlete_id);
    let profMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,name,sport")
        .in("id", ids);
      (profs ?? []).forEach((p) => profMap.set(p.id, p));
    }
    setMembers(
      (tm ?? []).map((m) => ({
        ...m,
        profile: profMap.get(m.athlete_id) ?? null,
      })) as Member[],
    );
  }

  async function createTeam() {
    if (!newName.trim()) return toast.error("팀명을 입력하세요");
    const { data, error } = await supabase
      .from("teams")
      .insert({
        coach_id: user!.id,
        team_name: newName.trim(),
        sport: newSport.trim() || null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("팀 생성됨");
    setShowCreate(false);
    setNewName("");
    setNewSport("");
    setSelectedTeamId(data.id);
    loadTeams();
  }

  async function addDemoAthlete() {
    if (!selectedTeamId) return;
    if (!demoName.trim()) return toast.error("이름을 입력하세요");
    // create a demo profile (no auth user). RLS policy "coach insert demo
    // athlete profiles" allows inserting with role=athlete & is_admin=false.
    const newId = crypto.randomUUID();
    const { error: pErr } = await supabase
      .from("profiles")
      .insert({
        id: newId,
        name: demoName.trim(),
        sport: demoSport.trim() || null,
        role: "athlete",
        is_admin: false,
      });
    if (pErr) return toast.error(pErr.message);
    const { error: mErr } = await supabase
      .from("team_members")
      .insert({ team_id: selectedTeamId, athlete_id: newId, is_active: true });
    if (mErr) return toast.error(mErr.message);
    toast.success(`${demoName} 추가됨`);
    setDemoName("");
    setDemoSport("");
    setShowAddAthlete(false);
    loadMembers(selectedTeamId);
  }

  async function removeMember(m: Member) {
    if (!confirm(`${m.profile?.name ?? "선수"} 제거?`)) return;
    const { error } = await supabase.from("team_members").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("제거됨");
    loadMembers(selectedTeamId!);
  }

  async function deleteTeam(t: Team) {
    if (!confirm(`팀 "${t.team_name}" 삭제?`)) return;
    await supabase.from("team_members").delete().eq("team_id", t.id);
    const { error } = await supabase.from("teams").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("삭제됨");
    setSelectedTeamId(null);
    loadTeams();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("초대코드 복사됨");
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;

  return (
    <>
      <TopBar title="선수관리" />
      <div className="container-mobile pb-24 pt-4">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : teams.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Users className="mx-auto mb-2 text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">아직 팀이 없습니다.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-3 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              <Plus size={14} /> 팀 만들기
            </button>
          </div>
        ) : (
          <>
            {/* Team tabs */}
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                    t.id === selectedTeamId
                      ? "border-primary bg-primary/15 text-primary font-semibold"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {t.team_name}
                </button>
              ))}
              <button
                onClick={() => setShowCreate(true)}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs"
              >
                <Plus size={12} className="inline" /> 팀
              </button>
            </div>

            {selectedTeam && (
              <>
                <div className="mt-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold">{selectedTeam.team_name}</div>
                      {selectedTeam.sport && (
                        <div className="text-xs text-muted-foreground">{selectedTeam.sport}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteTeam(selectedTeam)}
                      className="text-xs text-destructive"
                    >
                      팀 삭제
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground">초대코드</div>
                      <div className="num text-lg text-primary">{selectedTeam.invite_code}</div>
                    </div>
                    <button
                      onClick={() => copyCode(selectedTeam.invite_code)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs"
                    >
                      <Copy size={12} className="inline" /> 복사
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold">선수 ({members.length})</h2>
                  <button
                    onClick={() => setShowAddAthlete(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                  >
                    <Plus size={12} /> 데모 선수 추가
                  </button>
                </div>

                <div className="mt-2 space-y-2">
                  {members.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-4 text-center text-xs text-muted-foreground">
                      선수가 없습니다. 초대코드를 공유하거나 데모 선수를 추가하세요.
                    </div>
                  ) : (
                    members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                      >
                        <div>
                          <div className="font-semibold">{m.profile?.name ?? "(이름 없음)"}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.profile?.sport ?? "—"}
                          </div>
                        </div>
                        <button
                          onClick={() => removeMember(m)}
                          className="rounded-lg border border-destructive/40 p-1.5 text-destructive"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </>
        )}

        {showCreate && (
          <Modal title="팀 만들기" onClose={() => setShowCreate(false)}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="팀명"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            />
            <input
              value={newSport}
              onChange={(e) => setNewSport(e.target.value)}
              placeholder="종목 (선택)"
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            />
            <button
              onClick={createTeam}
              className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground"
            >
              생성
            </button>
          </Modal>
        )}

        {showAddAthlete && (
          <Modal title="데모 선수 추가" onClose={() => setShowAddAthlete(false)}>
            <p className="mb-2 text-xs text-muted-foreground">
              실제 회원가입 없이 시연용 프로필을 추가합니다.
            </p>
            <input
              value={demoName}
              onChange={(e) => setDemoName(e.target.value)}
              placeholder="이름"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            />
            <input
              value={demoSport}
              onChange={(e) => setDemoSport(e.target.value)}
              placeholder="종목 (선택)"
              className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm"
            />
            <button
              onClick={addDemoAthlete}
              className="mt-3 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground"
            >
              추가
            </button>
          </Modal>
        )}
      </div>
    </>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-4 sm:rounded-2xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground">
            닫기
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
