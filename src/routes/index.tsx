import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { PageLoading } from "@/components/PageLoading";

export const Route = createFileRoute("/")({
  component: IndexRedirect,
});

function IndexRedirect() {
  const { user, loading } = useAuth();
  const [target, setTarget] = useState<"/coach" | "/onboarding" | "/templates" | "/today" | null>(null);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "coach") {
        setTarget("/coach");
        return;
      }


      const [{ data: lifts }, { data: active }] = await Promise.all([
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
      const liftCount = new Set((lifts ?? []).map((lift) => lift.lift_type)).size;
      if ((liftCount ?? 0) < 7) setTarget("/onboarding");
      else if (!active) setTarget("/templates");
      else setTarget("/today");
    })();
  }, [user]);

  if (loading) {
    return <PageLoading message="로그인 정보를 확인하고 있어요" />;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!target) {
    return <PageLoading message="이동할 페이지를 준비하고 있어요" />;
  }
  return <Navigate to={target} replace />;
}
