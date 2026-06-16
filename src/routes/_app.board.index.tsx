import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Plus, ChevronDown, ChevronUp, Pin, Eye, MessageCircle, ThumbsUp, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/TopBar";
import {
  BOARD_CATEGORIES,
  BOARD_CATEGORY_LABELS,
  BOARD_SORT,
  BOARD_SORT_LABELS,
  type BoardCategory,
  type BoardSort,
} from "@/lib/types";

export const Route = createFileRoute("/_app/board/")({
  component: BoardPage,
});

interface Post {
  id: string;
  title: string;
  content: string;
  category: BoardCategory;
  is_pinned: boolean;
  is_faq: boolean;
  is_resolved: boolean;
  views_count: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author_id: string;
  author_name?: string;
}

function BoardPage() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [faqs, setFaqs] = useState<Post[]>([]);
  const [cat, setCat] = useState<BoardCategory | "all">("all");
  const [sort, setSort] = useState<BoardSort>("latest");
  const [q, setQ] = useState("");
  const [openFaq, setOpenFaq] = useState(true);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let qb = supabase
      .from("board_posts")
      .select("id,title,content,category,is_pinned,is_faq,is_resolved,views_count,likes_count,comments_count,created_at,author_id")
      .eq("is_hidden", false);
    if (cat !== "all") qb = qb.eq("category", cat);
    if (q.trim()) qb = qb.or(`title.ilike.%${q}%,content.ilike.%${q}%`);
    if (sort === "latest") qb = qb.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
    else if (sort === "popular") qb = qb.order("likes_count", { ascending: false });
    else if (sort === "comments") qb = qb.order("comments_count", { ascending: false });
    else qb = qb.order("views_count", { ascending: false });
    const { data } = await qb.limit(50);
    const list = (data ?? []) as Post[];

    // attach author names
    const ids = Array.from(new Set(list.map((p) => p.author_id)));
    if (ids.length) {
      const { data: pf } = await supabase.from("profiles").select("id,name").in("id", ids);
      const map = new Map((pf ?? []).map((p) => [p.id, p.name]));
      list.forEach((p) => (p.author_name = map.get(p.author_id) || "선수"));
    }
    setPosts(list);

    const { data: faqData } = await supabase
      .from("board_posts")
      .select("id,title,content,category,is_pinned,is_faq,is_resolved,views_count,likes_count,comments_count,created_at,author_id")
      .eq("is_faq", true)
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setFaqs((faqData ?? []) as Post[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [cat, sort]);

  return (
    <>
      <TopBar title="게시판" />
      <div className="container-mobile pb-24 pt-3">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="제목·본문 검색"
            className="w-full rounded-xl border border-border bg-secondary py-3 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* FAQ */}
        {faqs.length > 0 && (
          <div className="mt-3 rounded-2xl border border-border bg-card p-4">
            <button
              className="flex w-full items-center justify-between"
              onClick={() => setOpenFaq(!openFaq)}
            >
              <span className="font-bold">❓ 자주 묻는 질문</span>
              {openFaq ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {openFaq && (
              <ul className="mt-3 space-y-2">
                {faqs.map((f) => (
                  <li key={f.id}>
                    <Link
                      to="/board/$postId"
                      params={{ postId: f.id }}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      • {f.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Category chips */}
        <div className="mt-3 -mx-4 overflow-x-auto px-4">
          <div className="flex gap-2 pb-1">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>전체</Chip>
            {BOARD_CATEGORIES.map((c) => (
              <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                {BOARD_CATEGORY_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="mt-2 flex gap-2 text-xs">
          {BOARD_SORT.map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 ${
                sort === s ? "bg-primary/20 text-primary" : "text-muted-foreground"
              }`}
            >
              {BOARD_SORT_LABELS[s]}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중…</div>
          ) : posts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">첫 글을 작성해보세요</div>
          ) : (
            posts.map((p) => (
              <Link
                key={p.id}
                to="/board/$postId"
                params={{ postId: p.id }}
                className="block rounded-2xl border border-border bg-card p-4"
              >
                <div className="mb-1 flex items-center gap-2 text-xs">
                  {p.is_pinned && <Pin size={12} className="text-primary" />}
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {BOARD_CATEGORY_LABELS[p.category]}
                  </span>
                  {p.is_resolved && (
                    <span className="flex items-center gap-1 text-[10px] text-success">
                      <CheckCircle size={10} />해결됨
                    </span>
                  )}
                </div>
                <div className={`font-semibold ${p.is_resolved ? "text-muted-foreground" : ""}`}>
                  {p.title}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {p.author_name} · {timeAgo(p.created_at)}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5"><Eye size={11} />{p.views_count}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={11} />{p.comments_count}</span>
                    <span className="flex items-center gap-0.5"><ThumbsUp size={11} />{p.likes_count}</span>
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* FAB */}
        <button
          onClick={() => navigate({ to: "/board/write" })}
          className="fixed bottom-20 right-1/2 z-30 flex h-14 w-14 translate-x-[224px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
          aria-label="글쓰기"
        >
          <Plus size={24} />
        </button>
      </div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "방금";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
