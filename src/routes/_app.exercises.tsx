import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BODY_PART_LABELS, DIFFICULTY_LABELS } from "@/lib/types";
import { Search, X, Play } from "lucide-react";

export const Route = createFileRoute("/_app/exercises")({
  component: ExercisesPage,
});

interface Exercise {
  id: string;
  exercise_name: string;
  body_part: string;
  difficulty: string;
  youtube_video_id: string | null;
  is_main_lift: boolean;
  description: string | null;
}

const PARTS = ["all", "chest", "back", "legs", "shoulders", "arms", "core", "full_body"];

function ExercisesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [part, setPart] = useState("all");
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const [exerciseRes, profileRes] = await Promise.all([
        supabase
          .from("exercise_library")
          .select("*")
          .order("is_main_lift", { ascending: false })
          .order("exercise_name"),
        user ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const data = exerciseRes.data;
      setItems(data ?? []);
      setIsAdmin(!!(profileRes.data as any)?.is_admin);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter(
      (e) =>
        (part === "all" || e.body_part === part) &&
        (!q || e.exercise_name.toLowerCase().includes(q.toLowerCase())),
    );
  }, [items, part, q]);

  return (
    <div className="container-mobile py-6">
      <h1 className="text-2xl font-bold">운동 검색</h1>
      {isAdmin && (
        <Link
          to="/admin/exercises"
          className="mt-3 flex w-full items-center justify-center rounded-xl border border-primary/40 py-2 text-sm font-semibold text-primary"
        >
          관리자 · 운동 추가/수정
        </Link>
      )}

      <div className="relative mt-4">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="운동 이름 검색"
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-3 outline-none focus:border-primary"
        />
      </div>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2">
        {PARTS.map((p) => (
          <button
            key={p}
            onClick={() => setPart(p)}
            className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm ${
              part === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {p === "all" ? "전체" : BODY_PART_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {filtered.map((e) => (
          <button
            key={e.id}
            onClick={() => setPicked(e)}
            className="overflow-hidden rounded-xl border border-border bg-card text-left transition-all active:scale-95"
          >
            <div className="relative aspect-video bg-secondary">
              {e.youtube_video_id && (
                <img
                  src={`https://i.ytimg.com/vi/${e.youtube_video_id}/mqdefault.jpg`}
                  alt={e.exercise_name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play size={28} className="fill-white text-white" />
              </div>
              {e.is_main_lift && (
                <div className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  메인
                </div>
              )}
            </div>
            <div className="p-2">
              <div className="line-clamp-1 text-sm font-medium">{e.exercise_name}</div>
              <div className="text-[11px] text-muted-foreground">
                {BODY_PART_LABELS[e.body_part]} · {DIFFICULTY_LABELS[e.difficulty]}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!filtered.length && (
        <div className="mt-10 text-center text-sm text-muted-foreground">결과가 없습니다.</div>
      )}

      {picked && (
        <div
          onClick={() => setPicked(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="flex items-center justify-between p-3">
              <div className="font-bold">{picked.exercise_name}</div>
              <button onClick={() => setPicked(null)} className="text-muted-foreground">
                <X size={20} />
              </button>
            </div>
            {picked.youtube_video_id ? (
              <div className="aspect-video">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube.com/embed/${picked.youtube_video_id}?autoplay=1`}
                  title={picked.exercise_name}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center bg-secondary text-muted-foreground">
                영상 없음
              </div>
            )}
            <div className="p-4 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                  {BODY_PART_LABELS[picked.body_part]}
                </span>
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                  {DIFFICULTY_LABELS[picked.difficulty]}
                </span>
              </div>
              {picked.description && <p className="mt-3">{picked.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
