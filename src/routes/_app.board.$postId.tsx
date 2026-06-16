import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ThumbsUp, Flag, CheckCircle, Trash2, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BOARD_CATEGORY_LABELS, REPORT_REASONS, type BoardCategory } from "@/lib/types";
import { notify } from "@/lib/notify";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/board/$postId")({
  component: PostDetail,
});

interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  category: BoardCategory;
  is_resolved: boolean;
  is_faq: boolean;
  views_count: number;
  likes_count: number;
  created_at: string;
}
interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  content: string;
  likes_count: number;
  is_best: boolean;
  created_at: string;
  author_name?: string;
  author_role?: string;
  liked?: boolean;
}

function PostDetail() {
  const { postId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("athlete");
  const [comments, setComments] = useState<Comment[]>([]);
  const [liked, setLiked] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);

  async function load() {
    const { data: p } = await supabase
      .from("board_posts")
      .select("*")
      .eq("id", postId)
      .maybeSingle();
    if (!p) return;
    setPost(p as Post);

    // increment views (best-effort)
    await supabase.from("board_posts").update({ views_count: (p.views_count || 0) + 1 }).eq("id", postId);

    const { data: a } = await supabase.from("profiles").select("name,role").eq("id", p.author_id).maybeSingle();
    setAuthorName(a?.name || "선수");
    setAuthorRole(a?.role || "athlete");

    const { data: cs } = await supabase
      .from("board_comments")
      .select("*")
      .eq("post_id", postId)
      .eq("is_hidden", false)
      .order("is_best", { ascending: false })
      .order("created_at", { ascending: true });
    const list = (cs ?? []) as Comment[];
    const ids = Array.from(new Set(list.map((c) => c.author_id)));
    if (ids.length) {
      const { data: pf } = await supabase.from("profiles").select("id,name,role").in("id", ids);
      const m = new Map((pf ?? []).map((u) => [u.id, u]));
      list.forEach((c) => {
        const u = m.get(c.author_id);
        c.author_name = u?.name || "선수";
        c.author_role = u?.role || "athlete";
      });
    }
    // own likes
    if (user) {
      const { data: ml } = await supabase
        .from("board_comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .in("comment_id", list.map((c) => c.id));
      const liked = new Set((ml ?? []).map((x) => x.comment_id));
      list.forEach((c) => (c.liked = liked.has(c.id)));

      const { data: pl } = await supabase
        .from("board_post_likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("post_id", postId)
        .maybeSingle();
      setLiked(!!pl);
    }
    setComments(list);
  }

  useEffect(() => {
    load();
  }, [postId, user]);

  async function toggleLike() {
    if (!user || !post) return;
    if (liked) {
      await supabase.from("board_post_likes").delete().eq("user_id", user.id).eq("post_id", post.id);
      setLiked(false);
      setPost({ ...post, likes_count: Math.max(post.likes_count - 1, 0) });
    } else {
      await supabase.from("board_post_likes").insert({ user_id: user.id, post_id: post.id });
      setLiked(true);
      setPost({ ...post, likes_count: post.likes_count + 1 });
      if (post.author_id !== user.id) {
        notify(post.author_id, "like", "내 글에 좋아요", post.title, `/board/${post.id}`);
      }
    }
  }

  async function submitComment() {
    if (!user || !post || !newComment.trim()) return;
    const { error } = await supabase.from("board_comments").insert({
      post_id: post.id,
      author_id: user.id,
      parent_comment_id: replyTo,
      content: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    if (post.author_id !== user.id) {
      notify(post.author_id, "comment", "내 글에 댓글", newComment.slice(0, 60), `/board/${post.id}`);
    }
    setNewComment("");
    setReplyTo(null);
    load();
  }

  async function likeComment(c: Comment) {
    if (!user) return;
    if (c.liked) {
      await supabase.from("board_comment_likes").delete().eq("user_id", user.id).eq("comment_id", c.id);
    } else {
      await supabase.from("board_comment_likes").insert({ user_id: user.id, comment_id: c.id });
      if (c.author_id !== user.id) {
        notify(c.author_id, "like", "내 댓글에 좋아요", c.content.slice(0, 60), `/board/${postId}`);
      }
    }
    load();
  }

  async function report(targetType: "post" | "comment", targetId: string) {
    if (!user) return;
    const reason = prompt(`신고 사유:\n${REPORT_REASONS.join(" / ")}`);
    if (!reason) return;
    const { error } = await supabase.from("board_reports").insert({
      target_type: targetType as never,
      target_id: targetId,
      reporter_id: user.id,
      reason,
    });
    if (error) toast.error("이미 신고했거나 오류");
    else toast.success("신고가 접수되었습니다");
  }

  async function toggleResolved() {
    if (!user || !post || post.author_id !== user.id) return;
    await supabase.from("board_posts").update({ is_resolved: !post.is_resolved }).eq("id", post.id);
    load();
  }

  async function deletePost() {
    if (!user || !post) return;
    if (!confirm("이 글을 삭제할까요?")) return;
    await supabase.from("board_posts").delete().eq("id", post.id);
    navigate({ to: "/board" });
  }

  if (!post) return <div className="container-mobile py-8 text-sm text-muted-foreground">불러오는 중…</div>;

  const isOwner = user?.id === post.author_id;
  const tree = buildCommentTree(comments);

  return (
    <div className="container-mobile pb-24 pt-4">
      <button onClick={() => navigate({ to: "/board" })} className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft size={16} /> 게시판
      </button>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-secondary px-2 py-0.5 text-muted-foreground">{BOARD_CATEGORY_LABELS[post.category]}</span>
          {post.is_resolved && (
            <span className="flex items-center gap-1 text-success"><CheckCircle size={12} />해결됨</span>
          )}
        </div>
        <h1 className="mt-2 text-xl font-bold">{post.title}</h1>
        <div className="mt-1 text-xs text-muted-foreground">
          {authorName}{authorRole === "coach" && <span className="ml-1 text-coach">🏆</span>} · {new Date(post.created_at).toLocaleString("ko-KR")} · 조회 {post.views_count}
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm leading-6">{post.content}</div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={toggleLike}
            className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
              liked ? "border-primary bg-primary/10 text-primary" : "border-border"
            }`}
          >
            <ThumbsUp size={14} /> {post.likes_count}
          </button>
          {post.category === "question" && isOwner && (
            <button onClick={toggleResolved} className="rounded-lg border border-border px-3 py-2 text-sm">
              {post.is_resolved ? "해결 취소" : "해결됨"}
            </button>
          )}
          {!isOwner && (
            <button onClick={() => report("post", post.id)} className="ml-auto rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
              <Flag size={14} />
            </button>
          )}
          {isOwner && (
            <button onClick={deletePost} className="ml-auto rounded-lg border border-border px-3 py-2 text-sm text-destructive">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <h2 className="mt-6 mb-2 text-sm font-bold">댓글 {comments.length}</h2>
      <div className="space-y-2">
        {tree.map((c) => (
          <CommentItem
            key={c.id}
            c={c}
            onLike={likeComment}
            onReply={(id) => setReplyTo(id)}
            onReport={report}
            currentUserId={user?.id}
          />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-3">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>대댓글 작성 중</span>
            <button onClick={() => setReplyTo(null)} className="text-primary">취소</button>
          </div>
        )}
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="댓글을 입력하세요"
          rows={3}
          className="w-full rounded-lg border border-border bg-secondary p-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submitComment}
          className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground"
        >
          등록
        </button>
      </div>
    </div>
  );
}

interface CommentNode extends Comment {
  children: CommentNode[];
}
function buildCommentTree(list: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  list.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  map.forEach((n) => {
    if (n.parent_comment_id && map.has(n.parent_comment_id)) {
      map.get(n.parent_comment_id)!.children.push(n);
    } else {
      roots.push(n);
    }
  });
  // best first among roots
  roots.sort((a, b) => Number(b.is_best) - Number(a.is_best));
  return roots;
}

function CommentItem({
  c,
  onLike,
  onReply,
  onReport,
  currentUserId,
  depth = 0,
}: {
  c: CommentNode;
  onLike: (c: Comment) => void;
  onReply: (id: string) => void;
  onReport: (type: "post" | "comment", id: string) => void;
  currentUserId?: string;
  depth?: number;
}) {
  return (
    <div className={depth > 0 ? "ml-6" : ""}>
      <div className={`rounded-xl border p-3 ${c.is_best ? "border-coach bg-coach/5" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            {c.is_best && <Award size={12} className="text-coach" />}
            <span className="font-semibold">{c.author_name}</span>
            {c.author_role === "coach" && <span className="text-coach">🏆</span>}
          </span>
          <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString("ko-KR")}</span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm">{c.content}</div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button
            onClick={() => onLike(c)}
            className={`flex items-center gap-1 ${c.liked ? "text-primary" : "text-muted-foreground"}`}
          >
            <ThumbsUp size={11} /> {c.likes_count}
          </button>
          {depth === 0 && (
            <button onClick={() => onReply(c.id)} className="text-muted-foreground">답글</button>
          )}
          {currentUserId !== c.author_id && (
            <button onClick={() => onReport("comment", c.id)} className="ml-auto text-muted-foreground">
              <Flag size={11} />
            </button>
          )}
        </div>
      </div>
      {c.children.map((child) => (
        <CommentItem
          key={child.id}
          c={child}
          onLike={onLike}
          onReply={onReply}
          onReport={onReport}
          currentUserId={currentUserId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
