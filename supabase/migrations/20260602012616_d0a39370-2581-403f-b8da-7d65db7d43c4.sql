
CREATE TABLE public.athlete_routine_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  source_template_id uuid,
  assignment_source text NOT NULL DEFAULT 'personalized',
  split_type text NOT NULL,
  days_per_week integer NOT NULL,
  duration_weeks integer NOT NULL DEFAULT 8,
  weekday_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority_lifts text[] NOT NULL DEFAULT '{}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_week integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_routine_assignments TO authenticated;
GRANT ALL ON public.athlete_routine_assignments TO service_role;

ALTER TABLE public.athlete_routine_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own assignment all"
ON public.athlete_routine_assignments
FOR ALL TO authenticated
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "coach view member assignments"
ON public.athlete_routine_assignments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM team_members tm
  JOIN teams t ON t.id = tm.team_id
  WHERE tm.athlete_id = athlete_routine_assignments.athlete_id
    AND t.coach_id = auth.uid()
    AND tm.is_active
));

CREATE POLICY "admin manage assignments"
ON public.athlete_routine_assignments
FOR ALL TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE TRIGGER update_athlete_routine_assignments_updated_at
BEFORE UPDATE ON public.athlete_routine_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_ara_athlete_active ON public.athlete_routine_assignments(athlete_id, is_active);

ALTER TABLE public.athlete_preferences
  ADD COLUMN IF NOT EXISTS routine_assignment_source text,
  ADD COLUMN IF NOT EXISTS athlete_assigned_routine_id uuid;
