import {
  createFileRoute,
  Outlet,
  Navigate,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { BottomTabs } from "@/components/BottomTabs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSubscription } from "@/lib/subscription";
import { PageLoading } from "@/components/PageLoading";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [checking, setChecking] = useState(true);
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [isAdmin, setIsAdmin] = useState(false);

  const ADMIN_EMAILS = ["pmj11287@gmail.com"];
  const emailIsAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setChecking(true);
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profileError) {
        console.error(profileError);
        setChecking(false);
        return;
      }
      const userRole = (profile?.role as "athlete" | "coach") ?? "athlete";
      setRole(userRole);
      const adminFlag = !!profile?.is_admin || emailIsAdmin;
      setIsAdmin(adminFlag);

      // Subscription / trial guard (admins skip)
      if (!adminFlag) {
        const sub = await fetchSubscription(user.id);
        if (cancelled) return;
        // Allow profile / subscribe / board even when expired
        const allowedWhenExpired =
          path === "/profile" || path.startsWith("/board");
        if (!sub.isAllowed && !allowedWhenExpired) {
          setChecking(false);
          // /subscribe is OUTSIDE /_app, so do a router-level navigate
          navigate({ to: "/subscribe", replace: true });
          return;
        }
      }

      // Admins skip athlete onboarding/template gate
      if (adminFlag) {
        setChecking(false);
        return;
      }

      if (userRole === "coach") {
        setChecking(false);
        if (
          !path.startsWith("/coach") &&
          !path.startsWith("/board") &&
          path !== "/profile"
        )
          navigate({ to: "/coach", replace: true });
        return;
      }

      // Demo account: skip onboarding/template selection so reviewers land
      // straight on the main app without setup friction.
      const isDemo = user.email === "demo@bstrength.app";
      if (isDemo) {
        setChecking(false);
        if (path === "/onboarding" || path === "/templates") {
          navigate({ to: "/home", replace: true });
        }
        return;
      }




      const [{ data: lifts, error: liftsError }, { data: active, error: activeError }] =
        await Promise.all([
          supabase
            .from("athlete_lifts")
            .select("lift_type")
            .eq("athlete_id", user.id)
            .eq("is_current", true),
          supabase
            .from("athlete_active_template")
            .select("id")
            .eq("athlete_id", user.id)
            .eq("is_active", true)
            .maybeSingle(),
        ]);
      if (cancelled) return;
      if (liftsError || activeError) {
        console.error(liftsError ?? activeError);
        setChecking(false);
        return;
      }
      // Always allow board access regardless of onboarding state
      if (path.startsWith("/board") || path === "/profile") {
        setChecking(false);
        return;
      }
      const liftCount = new Set((lifts ?? []).map((lift) => lift.lift_type)).size;
      if (liftCount < 7 && path !== "/onboarding") {
        navigate({ to: "/onboarding", replace: true });
      } else if (liftCount >= 7 && !active && path !== "/templates") {
        navigate({ to: "/templates", replace: true });
      } else if (liftCount >= 7 && active && path === "/templates") {
        navigate({ to: "/today", replace: true });
      } else {
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate, path, emailIsAdmin]);

  // Safety net: never let "확인 중…" hang indefinitely. If the auth/subscription
  // check is still in flight after 6s, drop the gate so the underlying page can
  // at least render its own fallback UI instead of a black screen.
  useEffect(() => {
    if (!checking) return;
    const t = setTimeout(() => setChecking(false), 6000);
    return () => clearTimeout(t);
  }, [checking]);

  if (loading) {
    return <PageLoading message="로그인 정보를 확인하고 있어요" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (checking) {
    return <PageLoading message="계정 정보를 확인하고 있어요" />;
  }

  return (
    <div className="min-h-screen pb-20">
      <Outlet />
      <BottomTabs role={role} isAdmin={isAdmin} />
    </div>
  );
}
