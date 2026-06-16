import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BODY_PART_LABELS, DIFFICULTY_LABELS } from "@/lib/types";
import { ArrowLeft, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/exercises")({
  component: AdminExercisesPage,
});

type BodyPart = "chest" | "back" | "legs" | "shoulders" | "arms" | "core" | "full_body";
type Difficulty = "beginner" | "intermediate" | "advanced";

interface ExerciseRow {
  id: string;
  exercise_name: string;
  body_part: BodyPart;
  difficulty: Difficulty;
  description: string | null;
  youtube_url: string | null;
  youtube_video_id: string | null;
  thumbnail_url: string | null;
  is_main_lift: boolean;
}

const BODY_PARTS: BodyPart[] = ["chest", "back", "legs", "shoulders", "arms", "core", "full_body"];
const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];

function AdminExercisesPage() {
  const [items, setItems] = useState<ExerciseRow[]>([]);
  const [editing, setEditing] = useState<ExerciseRow | null | "new">(null);

  async function load() {
    const { data, error } = await supabase
      .from("exercise_library")
      .select("*")
      .order("is_main_lift", { ascending: false })
      .order("exercise_name");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as ExerciseRow[]);
  }

  useEffect(() => { load(); }, []);

  async function remove(row: ExerciseRow) {
    if (row.is_main_lift) return toast.error("7대 운동은 삭제하지 않도록 보호했습니다.");
    if (!confirm(`${row.exercise_name}을(를) 삭제할까요?`)) return;
    const { error } = await supabase.from("exercise_library").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("운동 삭제됨");
    load();
  }

  return (
    <div className="container-mobile py-6 pb-24">
      <Link to="/admin" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> 관리자
      </Link>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">운동 라이브러리 관리</h1>
          <p className="mt-1 text-xs text-muted-foreground">운동검색에 노출할 운동을 직접 추가합니다.</p>
        </div>
        <button onClick={() => setEditing("new")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" title="운동 추가">
          <Plus size={18} />
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {items.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{row.exercise_name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {BODY_PART_LABELS[row.body_part]} · {DIFFICULTY_LABELS[row.difficulty]}
                  {row.is_main_lift ? " · 7대 운동" : ""}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(row)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-primary" title="수정">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(row)} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-destructive disabled:opacity-40" disabled={row.is_main_lift} title="삭제">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ExerciseEditorModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const direct = trimmed.match(/^[a-zA-Z0-9_-]{8,}$/)?.[0];
  if (direct && !trimmed.includes("/")) return direct;
  return trimmed.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

function ExerciseEditorModal({ initial, onClose, onSaved }: { initial: ExerciseRow | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(initial?.exercise_name ?? "");
  const [bodyPart, setBodyPart] = useState<BodyPart>(initial?.body_part ?? "full_body");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "beginner");
  const [youtube, setYoutube] = useState(initial?.youtube_url ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return toast.error("운동 이름을 입력해주세요");
    setSaving(true);
    const videoId = extractYoutubeId(youtube);
    const payload = {
      exercise_name: name.trim(),
      body_part: bodyPart,
      difficulty,
      description: description.trim() || null,
      youtube_url: youtube.trim() || null,
      youtube_video_id: videoId,
      thumbnail_url: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      is_main_lift: initial?.is_main_lift ?? false,
    };
    const { error } = initial
      ? await supabase.from("exercise_library").update(payload).eq("id", initial.id)
      : await supabase.from("exercise_library").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(initial ? "운동 수정됨" : "운동 추가됨");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{initial ? "운동 수정" : "운동 추가"}</h3>
          <button onClick={onClose} className="text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="mt-4 space-y-3">
          <TextField label="운동 이름" value={name} onChange={setName} placeholder="예: 바벨 로우" />
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="text-muted-foreground">부위</span>
              <select value={bodyPart} onChange={(e) => setBodyPart(e.target.value as BodyPart)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm">
                {BODY_PARTS.map((p) => <option key={p} value={p}>{BODY_PART_LABELS[p]}</option>)}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-muted-foreground">난이도</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm">
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
              </select>
            </label>
          </div>
          <TextField label="YouTube URL 또는 영상 ID" value={youtube} onChange={setYoutube} placeholder="https://youtu.be/..." />
          <label className="block text-xs">
            <span className="text-muted-foreground">설명</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm" />
          </label>
        </div>
        <button disabled={saving} onClick={save} className="mt-5 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-2 text-sm" />
    </label>
  );
}
