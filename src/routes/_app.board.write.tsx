import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BOARD_CATEGORIES, BOARD_CATEGORY_LABELS, type BoardCategory } from "@/lib/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/board/write")({
  component: WritePage,
});

function WritePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<BoardCategory>("free");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; title: string }[]>([]);

  // FAQ 자동 추천
  useEffect(() => {
    const q = title.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("board_posts")
        .select("id,title")
        .eq("is_faq", true)
        .ilike("title", `%${q}%`)
        .limit(3);
      setSuggestions(data ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [title]);

  async function submit() {
    if (!user) return;
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 본문을 입력하세요");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("board_posts")
      .insert({
        author_id: user.id,
        title: title.trim(),
        content: content.trim(),
        category: category as never,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("등록되었습니다");
    navigate({ to: "/board/$postId", params: { postId: data.id } });
  }

  return (
    <div className="container-mobile pb-24 pt-4">
      <button onClick={() => navigate({ to: "/board" })} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> 게시판
      </button>
      <h1 className="text-xl font-bold">글쓰기</h1>

      <div className="mt-4">
        <label className="text-xs text-muted-foreground">카테고리</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {BOARD_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                category === c ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {BOARD_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목"
        className="mt-4 w-full rounded-xl border border-border bg-secondary p-3 text-sm outline-none focus:border-primary"
      />

      {suggestions.length > 0 && (
        <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <div className="mb-1 text-xs font-semibold text-primary">💡 혹시 이 답변 찾으셨나요?</div>
          {suggestions.map((s) => (
            <Link
              key={s.id}
              to="/board/$postId"
              params={{ postId: s.id }}
              className="block py-1 text-xs text-muted-foreground hover:text-primary"
            >
              • {s.title}
            </Link>
          ))}
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="내용을 입력하세요"
        rows={10}
        className="mt-3 w-full rounded-xl border border-border bg-secondary p-3 text-sm outline-none focus:border-primary"
      />

      <button
        onClick={submit}
        disabled={saving}
        className="mt-4 w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground disabled:opacity-40"
      >
        {saving ? "등록 중…" : "등록하기"}
      </button>
    </div>
  );
}
