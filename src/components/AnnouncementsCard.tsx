import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const PINNED: Announcement[] = [
  {
    id: "pinned-1",
    title: "루틴은 선수 상태에 따라 직접 선택·조정할 수 있습니다",
    content: "프로필에서 시즌 상태, 종목 훈련 강도, 선호 요일을 바꾸면 다음 미완료 세션부터 반영됩니다. 과거 완료 기록은 변경되지 않습니다.",
    created_at: new Date().toISOString(),
  },
  {
    id: "pinned-2",
    title: "과거 완료 기록은 변경되지 않습니다",
    content: "이미 완료된 세션의 세트·중량·횟수는 추후 설정 변경이나 루틴 교체와 관계없이 그대로 보존됩니다.",
    created_at: new Date().toISOString(),
  },
  {
    id: "pinned-3",
    title: "중량은 참고 범위를 기반으로 직접 선택할 수 있습니다",
    content: "메인 운동의 추천 중량은 e1RM 기반 참고치입니다. 컨디션에 맞게 직접 조정해 입력하세요.",
    created_at: new Date().toISOString(),
  },
];

export function AnnouncementsCard() {
  const [items, setItems] = useState<Announcement[]>(PINNED);
  const [open, setOpen] = useState<Announcement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("announcements" as any)
        .select("id,title,content,created_at")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(3);
      const fetched = ((data ?? []) as unknown) as Announcement[];
      setItems(fetched.length ? fetched : PINNED);
    })();
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Megaphone size={16} className="text-primary" />
        <h2 className="text-sm font-bold">공지사항</h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => setOpen(a)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-secondary"
            >
              <span className="truncate text-sm">{a.title}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {new Date(a.created_at).toLocaleDateString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] rounded-2xl border border-border bg-card p-5"
          >
            <h3 className="text-lg font-bold">{open.title}</h3>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {new Date(open.created_at).toLocaleString("ko-KR")}
            </div>
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{open.content}</div>
            <button
              onClick={() => setOpen(null)}
              className="mt-5 w-full rounded-xl border border-border py-3"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
