import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { HABIT_EMOJIS } from "@/lib/types";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { CelebrationModal } from "@/components/CelebrationModal";


export const Route = createFileRoute("/_app/lifestyle")({
  component: LifestylePage,
});

interface Habit {
  id: string;
  habit_name: string;
  icon: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  url: string | null;
  content_type: string;
}

function LifestylePage() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checked, setChecked] = useState<Record<string, string>>({}); // habit_id → check_id
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("✅");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [celebOpen, setCelebOpen] = useState(false);


  const today = new Date().toISOString().slice(0, 10);

  const DEFAULT_HABITS: { habit_name: string; icon: string }[] = [
    { habit_name: "단백질 섭취", icon: "🥩" },
    { habit_name: "수분 섭취", icon: "💧" },
    { habit_name: "스트레칭", icon: "🧘" },
    { habit_name: "일찍 자기", icon: "😴" },
    { habit_name: "명상/호흡", icon: "☀️" },
    { habit_name: "회복 체크", icon: "🛌" },
  ];

  async function load() {
    if (!user) return;
    let { data: h } = await supabase
      .from("lifestyle_habits")
      .select("id, habit_name, icon")
      .eq("athlete_id", user.id)
      .eq("is_active", true)
      .order("order_index");
    if (!h || h.length === 0) {
      // First-time seed: create the 6 defaults so the page isn't blank.
      const seed = DEFAULT_HABITS.map((d, i) => ({
        athlete_id: user.id,
        habit_name: d.habit_name,
        icon: d.icon,
        order_index: i,
      }));
      const ins = await supabase
        .from("lifestyle_habits")
        .insert(seed)
        .select("id, habit_name, icon");
      h = ins.data ?? [];
    }
    setHabits(h ?? []);

    const { data: c } = await supabase
      .from("lifestyle_checks")
      .select("id, habit_id")
      .eq("athlete_id", user.id)
      .eq("date", today);
    const m: Record<string, string> = {};
    (c ?? []).forEach((r: any) => (m[r.habit_id] = r.id));
    setChecked(m);

    // simple streak (last 14 days)
    const since = new Date();
    since.setDate(since.getDate() - 13);
    const { data: hist } = await supabase
      .from("lifestyle_checks")
      .select("habit_id, date")
      .eq("athlete_id", user.id)
      .gte("date", since.toISOString().slice(0, 10));
    const byHabit: Record<string, Set<string>> = {};
    (hist ?? []).forEach((r: any) => {
      byHabit[r.habit_id] = byHabit[r.habit_id] ?? new Set();
      byHabit[r.habit_id].add(r.date);
    });
    const s: Record<string, number> = {};
    Object.entries(byHabit).forEach(([hid, set]) => {
      let n = 0;
      for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        if (set.has(d.toISOString().slice(0, 10))) n++;
        else if (i > 0) break;
      }
      s[hid] = n;
    });
    setStreaks(s);

    const { data: recs } = await (supabase.from("lifestyle_recommendations" as any) as any)
      .select("id,title,description,url,content_type")
      .eq("is_published", true)
      .order("order_index")
      .limit(6);
    setRecommendations(recs ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function toggle(h: Habit) {
    if (!user) return;
    const existing = checked[h.id];
    if (existing) {
      await supabase.from("lifestyle_checks").delete().eq("id", existing);
      const m = { ...checked };
      delete m[h.id];
      setChecked(m);
    } else {
      const { data } = await supabase
        .from("lifestyle_checks")
        .insert({ athlete_id: user.id, habit_id: h.id, date: today, checked: true })
        .select("id")
        .single();
      if (data) {
        const next = { ...checked, [h.id]: data.id };
        setChecked(next);
        if (habits.length > 0 && Object.keys(next).length === habits.length) {
          setCelebOpen(true);
        }

      }
    }
  }

  async function addHabit() {
    if (!user || !newName.trim()) return;
    const { error } = await supabase.from("lifestyle_habits").insert({
      athlete_id: user.id,
      habit_name: newName.trim(),
      icon: newIcon,
      order_index: habits.length,
    });
    if (error) return toast.error(error.message);
    setNewName("");
    setAdding(false);
    await load();
  }

  async function remove(id: string) {
    await supabase.from("lifestyle_habits").update({ is_active: false }).eq("id", id);
    await load();
  }

  const checkedCount = Object.keys(checked).length;

  return (
    <div className="container-mobile py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">생활습관</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg border border-primary/40 px-3 py-2 text-sm text-primary"
        >
          <Plus size={16} /> 추가
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="text-xs text-muted-foreground">오늘 달성</div>
        <div className="num mt-1 text-3xl">
          <span className="text-primary">{checkedCount}</span>
          <span className="text-muted-foreground"> / {habits.length}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${habits.length ? (checkedCount / habits.length) * 100 : 0}%` }}
          />
        </div>
        {habits.length > 0 && checkedCount === habits.length && (
          <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-3 text-center text-sm font-bold text-primary">
            완료했습니다! 오늘 생활습관을 모두 체크했어요.
          </div>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {habits.map((h) => {
          const done = !!checked[h.id];
          return (
            <div
              key={h.id}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                done ? "border-primary/40 bg-primary/5" : "border-border bg-card"
              }`}
            >
              <span className="text-2xl">{h.icon}</span>
              <div className="flex-1">
                <div className={`font-medium ${done ? "line-through opacity-60" : ""}`}>
                  {h.habit_name}
                </div>
                {streaks[h.id] > 1 && (
                  <div className="text-xs text-warning">🔥 {streaks[h.id]}일 연속</div>
                )}
              </div>
              <button
                onClick={() => remove(h.id)}
                className="text-muted-foreground/50 hover:text-destructive"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => toggle(h)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary"
                }`}
              >
                <Check size={18} strokeWidth={3} />
              </button>
            </div>
          );
        })}
        {!habits.length && (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            아직 습관이 없습니다. 우측 상단 + 버튼으로 추가하세요.
          </div>
        )}
      </div>

      {recommendations.length > 0 && (
        <section className="mt-8 pb-24">
          <h2 className="mb-3 font-bold">생활습관 추천 / 읽을거리</h2>
          <div className="space-y-2">
            {recommendations.map((rec) => (
              <a
                key={rec.id}
                href={rec.url ?? undefined}
                target={rec.url ? "_blank" : undefined}
                rel="noreferrer"
                className="block rounded-xl border border-border bg-card p-4"
              >
                <div className="text-[10px] font-semibold text-primary">
                  {rec.content_type === "article" ? "기사" : rec.content_type === "video" ? "영상" : "팁"}
                </div>
                <div className="mt-1 font-bold">{rec.title}</div>
                <p className="mt-1 text-sm text-muted-foreground">{rec.description}</p>
              </a>
            ))}
          </div>
        </section>
      )}

      {adding && (
        <div
          onClick={() => setAdding(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-5"
          >
            <h3 className="text-lg font-bold">새 습관 추가</h3>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 단백질 셰이크 마시기"
              className="mt-4 w-full rounded-lg border border-border bg-secondary px-3 py-3 outline-none focus:border-primary"
            />
            <div className="mt-3">
              <div className="mb-1 text-xs text-muted-foreground">아이콘</div>
              <div className="flex flex-wrap gap-2">
                {HABIT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setNewIcon(e)}
                    className={`h-10 w-10 rounded-lg border text-xl ${
                      newIcon === e ? "border-primary bg-primary/10" : "border-border bg-secondary"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setAdding(false)}
                className="flex-1 rounded-xl border border-border py-3"
              >
                취소
              </button>
              <button
                onClick={addHabit}
                className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      <CelebrationModal
        open={celebOpen}
        emoji="🌟"
        title="오늘 생활습관 완료!"
        description="좋은 습관은 좋은 성과로 이어집니다. 잘하셨어요!"
        onClose={() => setCelebOpen(false)}
      />
    </div>

  );
}
