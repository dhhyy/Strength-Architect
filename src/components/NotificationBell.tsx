import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

interface Notif {
  id: string;
  type: string;
  title: string;
  content: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notif[]);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [user]);

  async function markAll() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    load();
  }

  async function onClickItem(n: Notif) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    setOpen(false);
    load();
  }

  const unread = items.filter((i) => !i.is_read).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative rounded-full p-2 text-foreground hover:bg-secondary"
        aria-label="알림"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-0 -top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/70" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 h-full w-full max-w-[420px] overflow-y-auto bg-card p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">알림</h2>
              <div className="flex gap-2">
                <button onClick={markAll} className="text-xs text-muted-foreground">
                  모두 읽음
                </button>
                <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">
                  닫기
                </button>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">알림이 없어요</div>
            ) : (
              <div className="space-y-2">
                {items.map((n) => {
                  const body = (
                    <div
                      className={`rounded-xl border p-3 ${
                        n.is_read ? "border-border bg-secondary/50" : "border-primary/40 bg-secondary"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold">{n.title}</div>
                        {!n.is_read && (
                          <span className="mt-1 inline-block h-2 w-2 rounded-full bg-primary" />
                        )}
                      </div>
                      {n.content && (
                        <div className="mt-1 text-xs text-muted-foreground">{n.content}</div>
                      )}
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  );
                  return n.link ? (
                    <Link key={n.id} to={n.link} onClick={() => onClickItem(n)} className="block">
                      {body}
                    </Link>
                  ) : (
                    <button
                      key={n.id}
                      onClick={() => onClickItem(n)}
                      className="block w-full text-left"
                    >
                      {body}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
