
-- 1) Lock down teams SELECT (drop broad "auth lookup teams")
DROP POLICY IF EXISTS "auth lookup teams" ON public.teams;

-- Add RPC to join a team by invite code without exposing the table
CREATE OR REPLACE FUNCTION public.join_team_with_code(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT id INTO v_team_id FROM public.teams WHERE invite_code = upper(p_code) LIMIT 1;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  INSERT INTO public.team_members (team_id, athlete_id, is_active)
  VALUES (v_team_id, auth.uid(), true)
  ON CONFLICT DO NOTHING;
  RETURN v_team_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_team_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;

-- Team members can SELECT their team (coach policy already exists)
CREATE POLICY "team members read team"
  ON public.teams FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id AND tm.athlete_id = auth.uid() AND tm.is_active
  ));

-- 2) Prevent users from escalating to admin via self update on profiles
DROP POLICY IF EXISTS "self update" ON public.profiles;
CREATE POLICY "self update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid())
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 3) Restrict template_days / template_exercises to public templates
DROP POLICY IF EXISTS "public template_days" ON public.template_days;
CREATE POLICY "public template_days"
  ON public.template_days FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.routine_templates rt
    WHERE rt.id = template_days.template_id AND rt.is_public = true
  ));

DROP POLICY IF EXISTS "public template_exercises" ON public.template_exercises;
CREATE POLICY "public template_exercises"
  ON public.template_exercises FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.template_days td
    JOIN public.routine_templates rt ON rt.id = td.template_id
    WHERE td.id = template_exercises.template_day_id AND rt.is_public = true
  ));

-- 4) Lock down SECURITY DEFINER helpers from anon/authenticated direct execution
REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_answer_likes_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_post_comments_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_comment_likes_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_post_likes_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_reports_hide() FROM PUBLIC, anon, authenticated;

-- 5) Prevent listing of board-images bucket via storage.objects (keep public CDN read by object key)
DROP POLICY IF EXISTS "board images public read" ON storage.objects;
-- No SELECT policy on storage.objects for board-images: public bucket still serves files via public URL,
-- but clients can no longer enumerate object names.
