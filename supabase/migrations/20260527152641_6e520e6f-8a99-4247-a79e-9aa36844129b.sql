ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check,
  ADD CONSTRAINT profiles_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_age_check,
  ADD CONSTRAINT profiles_age_check CHECK (age IS NULL OR (age >= 1 AND age <= 120));

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS note text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_active_template TO authenticated;
GRANT ALL ON public.athlete_active_template TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'athlete_active_template'
      AND policyname = 'own active insert'
  ) THEN
    CREATE POLICY "own active insert"
    ON public.athlete_active_template
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = athlete_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'athlete_active_template'
      AND policyname = 'own active select'
  ) THEN
    CREATE POLICY "own active select"
    ON public.athlete_active_template
    FOR SELECT
    TO authenticated
    USING (auth.uid() = athlete_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'workout_logs'
      AND policyname = 'own log insert'
  ) THEN
    CREATE POLICY "own log insert"
    ON public.workout_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = athlete_id);
  END IF;
END $$;