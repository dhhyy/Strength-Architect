import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/habits")({
  component: AdminHabitRecommendationsPage,
});

type Rec = {
  id: string;
  title: string;
  description: string;
  url: string | null;
  content_type: "article" | "video" | "tip";
  is_published: boolean;
  order_index: number;
};

function AdminHabitRecommendationsPage() {
  const [items, setItems] = useState<Rec[]>([]);
  const [editing, setEditing] = useState<Rec | null>(null);

  async function load() {
    const { data, error } = await (supabase.from("lifestyle_recommendations" as any) as any)
      .select("*")
      .order("order_index")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setItems(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) return;
    const { error } = await (supabase.from("lifestyle_recommendations" as any) as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제됨");
    load();
  }

  return (
    <div className="container-mobile py-6 pb-24">
      <Link to="/admin" className="flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> 관리자
      </Link>
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">생활습관 추천관리</h1>
          <p className="mt-1 text-xs text-muted-foreground">생활습관 탭 하단에 노출될 글과 링크를 관리합니다.</p>
        </div>
        <button onClick={() => setEditing({ id: "", title: "", description: "", url: "", content_type: "tip", is_published: true, order_index: items.length })} className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus size={18} />
        </button>
      </div>
      <div className="mt-5 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.content_type} · {item.is_published ? "노출" : "숨김"}</div>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(item)} className="rounded-lg border border-border p-2 text-primary"><Pencil size={14} /></button>
                <button onClick={() => remove(item.id)} className="rounded-lg border border-border p-2 text-destructive"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && <RecommendationModal initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function RecommendationModal({ initial, onClose, onSaved }: { initial: Rec; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!form.title.trim()) return toast.error("제목을 입력해주세요");
    setSaving(true);
    const payload = { title: form.title.trim(), description: form.description.trim(), url: form.url?.trim() || null, content_type: form.content_type, is_published: form.is_published, order_index: form.order_index };
    const { error } = form.id
      ? await (supabase.from("lifestyle_recommendations" as any) as any).update(payload).eq("id", form.id)
      : await (supabase.from("lifestyle_recommendations" as any) as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("저장됨");
    onSaved();
  }
  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <h3 className="font-bold">추천 콘텐츠</h3>
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="제목" className="mt-4 w-full rounded-lg border border-border bg-secondary px-3 py-2" />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="한 줄 설명" rows={3} className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2" />
        <input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="URL" className="mt-2 w-full rounded-lg border border-border bg-secondary px-3 py-2" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select value={form.content_type} onChange={(e) => setForm({ ...form, content_type: e.target.value as Rec["content_type"] })} className="rounded-lg border border-border bg-secondary px-3 py-2">
            <option value="tip">팁</option><option value="article">기사</option><option value="video">영상</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> 노출
          </label>
        </div>
        <button disabled={saving} onClick={save} className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-50">{saving ? "저장 중…" : "저장"}</button>
      </div>
    </div>
  );
}
