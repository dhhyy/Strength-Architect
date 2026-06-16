import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Edit3 } from "lucide-react";

export const Route = createFileRoute("/admin/announcements")({
  component: AdminAnnouncementsPage,
});

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  created_at: string;
}

function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | null>(null);

  async function load() {
    const { data } = await supabase
      .from("announcements" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as any);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("삭제할까요?")) return;
    const { error } = await supabase.from("announcements" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("삭제됨");
    load();
  }

  async function togglePublish(a: Announcement) {
    const { error } = await supabase
      .from("announcements" as any)
      .update({ is_published: !a.is_published })
      .eq("id", a.id);
    if (error) return toast.error(error.message);
    load();
  }

  return (
    <div className="container-mobile py-6 pb-24">
      <h1 className="text-2xl font-bold">📢 공지사항 관리</h1>
      <button
        onClick={() =>
          setEditing({ id: "", title: "", content: "", is_published: true, created_at: "" })
        }
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"
      >
        <Plus size={18} /> 새 공지 작성
      </button>

      <div className="mt-6 space-y-3">
        {items.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            공지가 없습니다
          </div>
        )}
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{a.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.content}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  a.is_published ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {a.is_published ? "발행됨" : "비공개"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setEditing(a)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-primary/40 py-2 text-xs font-semibold text-primary"
              >
                <Edit3 size={14} /> 수정
              </button>
              <button
                onClick={() => togglePublish(a)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border py-2 text-xs"
              >
                {a.is_published ? "비공개" : "발행"}
              </button>
              <button
                onClick={() => remove(a.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-destructive/40 py-2 text-xs text-destructive"
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditModal
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  item,
  onClose,
  onSaved,
}: {
  item: Announcement;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [published, setPublished] = useState(item.is_published);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return toast.error("제목을 입력하세요");
    setSaving(true);
    let error;
    if (item.id) {
      ({ error } = await supabase
        .from("announcements" as any)
        .update({ title, content, is_published: published })
        .eq("id", item.id));
    } else {
      ({ error } = await supabase
        .from("announcements" as any)
        .insert({ title, content, is_published: published } as any));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("저장됨");
    onSaved();
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-5"
      >
        <h3 className="text-lg font-bold">{item.id ? "공지 수정" : "새 공지"}</h3>
        <div className="mt-4 space-y-3">
          <input
            placeholder="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-primary"
          />
          <textarea
            placeholder="내용"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-secondary px-3 py-2 outline-none focus:border-primary"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            발행
          </label>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-3">
            취소
          </button>
          <button
            disabled={saving}
            onClick={save}
            className="flex-1 rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
