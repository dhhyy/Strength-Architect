DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

-- Public-readable tables (have permissive SELECT policies for anon)
GRANT SELECT ON public.exercise_library TO anon;
GRANT SELECT ON public.routine_templates TO anon;
GRANT SELECT ON public.template_days TO anon;
GRANT SELECT ON public.template_exercises TO anon;
GRANT SELECT ON public.lifestyle_recommendations TO anon;
GRANT SELECT ON public.board_posts TO anon;
GRANT SELECT ON public.board_comments TO anon;
GRANT SELECT ON public.qna_posts TO anon;
GRANT SELECT ON public.qna_answers TO anon;

-- Ensure execute on helper security definer functions
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;