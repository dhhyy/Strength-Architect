import {
  createFileRoute,
  Outlet,
  Navigate,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { BottomTabs } from "@/components/BottomTabs";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const ADMIN_EMAILS = ["pmj11287@gmail.com"];

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const emailAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);
  const [status, setStatus] = useState<"checking" | "ok" | "denied">(
    emailAdmin ? "ok" : "checking",
  );

  useEffect(() => {
    if (!user) return;
    // Email-allowlisted admin: skip DB check entirely.
    if (emailAdmin) {
      setStatus("ok");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // On error, do NOT bounce — keep checking state cleared so user sees
      // a friendly denial rather than being redirected mid-flight.
      if (error) {
        setStatus("denied");
        return;
      }
      if (data?.is_admin) setStatus("ok");
      else {
        setStatus("denied");
        navigate({ to: "/home", replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, emailAdmin, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        로딩 중…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        확인 중…
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        관리자 권한이 필요합니다
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomTabs role="athlete" isAdmin={true} />
    </div>
  );
}
