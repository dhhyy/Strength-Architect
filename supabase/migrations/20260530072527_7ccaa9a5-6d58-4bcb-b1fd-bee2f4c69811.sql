CREATE TABLE IF NOT EXISTS public.lifestyle_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  url text,
  content_type text NOT NULL DEFAULT 'tip' CHECK (content_type IN ('article', 'video', 'tip')),
  is_published boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lifestyle_recommendations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lifestyle_recommendations TO authenticated;
GRANT ALL ON public.lifestyle_recommendations TO service_role;

ALTER TABLE public.lifestyle_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "published lifestyle recommendations" ON public.lifestyle_recommendations;
CREATE POLICY "published lifestyle recommendations"
ON public.lifestyle_recommendations
FOR SELECT
TO anon, authenticated
USING (is_published = true OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin manage lifestyle recommendations" ON public.lifestyle_recommendations;
CREATE POLICY "admin manage lifestyle recommendations"
ON public.lifestyle_recommendations
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_lifestyle_recommendations_updated_at ON public.lifestyle_recommendations;
CREATE TRIGGER update_lifestyle_recommendations_updated_at
BEFORE UPDATE ON public.lifestyle_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.daily_checkins
ADD CONSTRAINT daily_checkins_athlete_date_key UNIQUE (athlete_id, date);

ALTER TABLE public.lifestyle_checks
ADD CONSTRAINT lifestyle_checks_athlete_habit_date_key UNIQUE (athlete_id, habit_id, date);

CREATE INDEX IF NOT EXISTS idx_workout_logs_athlete_date ON public.workout_logs (athlete_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_routines_athlete_planned ON public.daily_routines (athlete_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_daily_routines_athlete_executed ON public.daily_routines (athlete_id, executed_date);

DROP POLICY IF EXISTS "coach insert team members" ON public.team_members;
CREATE POLICY "coach insert team members"
ON public.team_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coach update team members" ON public.team_members;
CREATE POLICY "coach update team members"
ON public.team_members
FOR UPDATE
TO authenticated
USING (public.is_team_coach(team_id, auth.uid()))
WITH CHECK (public.is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coach manage active template for team members" ON public.athlete_active_template;
CREATE POLICY "coach manage active template for team members"
ON public.athlete_active_template
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.athlete_id = athlete_active_template.athlete_id
      AND t.coach_id = auth.uid()
      AND tm.is_active
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.athlete_id = athlete_active_template.athlete_id
      AND t.coach_id = auth.uid()
      AND tm.is_active
  )
);

DROP POLICY IF EXISTS "coach insert demo athlete profiles" ON public.profiles;
CREATE POLICY "coach insert demo athlete profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (role = 'athlete' AND is_admin = false);
