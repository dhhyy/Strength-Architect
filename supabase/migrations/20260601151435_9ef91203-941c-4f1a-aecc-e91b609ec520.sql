-- Add height_cm to profiles (age, gender, bodyweight already exist)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm numeric;

-- Athlete preferences for routine builder
CREATE TABLE IF NOT EXISTS public.athlete_preferences (
  athlete_id uuid PRIMARY KEY,
  season_phase text NOT NULL DEFAULT 'offseason',           -- 'inseason' | 'offseason'
  sport_training_load text NOT NULL DEFAULT 'medium',       -- 'low' | 'medium' | 'high' | 'very_high'
  desired_lifting_days integer NOT NULL DEFAULT 3,          -- 3..6
  preferred_lifting_weekdays integer[] NOT NULL DEFAULT '{}', -- 0..6 (0=Sun)
  priority_lifts text[] NOT NULL DEFAULT '{}',              -- up to 3 lift_type values
  selected_routine_type text,                                -- the chosen template/routine label
  selected_template_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_preferences TO authenticated;
GRANT ALL ON public.athlete_preferences TO service_role;

ALTER TABLE public.athlete_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own preferences all"
  ON public.athlete_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "coach view member preferences"
  ON public.athlete_preferences
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.athlete_id = athlete_preferences.athlete_id
      AND t.coach_id = auth.uid()
      AND tm.is_active
  ));

CREATE TRIGGER update_athlete_preferences_updated_at
BEFORE UPDATE ON public.athlete_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
