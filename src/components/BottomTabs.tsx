import { Link, useRouterState } from "@tanstack/react-router";
import {
  Dumbbell,
  CalendarRange,
  Sparkles,
  Search,
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  User,
  Shield,
  ClipboardList,
} from "lucide-react";

const athleteTabs = [
  { to: "/home", label: "오늘", icon: Dumbbell },
  { to: "/records", label: "기록", icon: CalendarRange },
  { to: "/lifestyle", label: "생활습관", icon: Sparkles },
  { to: "/exercises", label: "운동검색", icon: Search },
  { to: "/board", label: "게시판", icon: MessageSquare },
  { to: "/profile", label: "프로필", icon: User },
] as const;

const coachTabs = [
  { to: "/coach", label: "대시보드", icon: LayoutDashboard },
  { to: "/coach/team", label: "선수관리", icon: Users },
  { to: "/coach/templates", label: "루틴배정", icon: FileText },
  { to: "/exercises", label: "운동검색", icon: Search },
  { to: "/board", label: "게시판", icon: MessageSquare },
  { to: "/profile", label: "프로필", icon: User },
] as const;

const adminTabs = [
  { to: "/admin/templates", label: "템플릿", icon: Shield },
  { to: "/admin/exercises", label: "운동관리", icon: Search },
  { to: "/admin/habits", label: "추천관리", icon: ClipboardList },
  { to: "/board", label: "게시판", icon: MessageSquare },
  { to: "/profile", label: "프로필", icon: User },
] as const;


export function BottomTabs({
  role,
  isAdmin = false,
}: {
  role: "athlete" | "coach";
  isAdmin?: boolean;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  // Admin tabs ONLY when actively in /admin section. Otherwise admin users
  // navigate as athletes; they enter admin mode via the profile button.
  const inAdminSection = path.startsWith("/admin");
  const tabs =
    isAdmin && inAdminSection
      ? adminTabs
      : role === "coach"
      ? coachTabs
      : athleteTabs;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">

      <div className="container-mobile flex h-16 items-center justify-around">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = path === t.to || path.startsWith(t.to + "/");
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={active ? "font-semibold" : ""}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
