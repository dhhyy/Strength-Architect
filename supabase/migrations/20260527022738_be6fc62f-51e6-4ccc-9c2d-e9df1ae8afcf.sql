
-- ENUMS
CREATE TYPE public.user_role AS ENUM ('athlete','coach');
CREATE TYPE public.lift_type AS ENUM ('squat','deadlift','bench','ohp','power_clean','pullup','dips','accessory');
CREATE TYPE public.split_type AS ENUM ('full_body','upper_lower','ppl','bro_split','custom');
CREATE TYPE public.difficulty_level AS ENUM ('beginner','intermediate','advanced');

-- 1. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'athlete',
  sport TEXT,
  bodyweight NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "self insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. athlete_lifts
CREATE TABLE public.athlete_lifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lift_type public.lift_type NOT NULL,
  weight_lifted NUMERIC NOT NULL,
  reps INT NOT NULL CHECK (reps BETWEEN 1 AND 20),
  e1rm NUMERIC NOT NULL,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX athlete_lifts_athlete_idx ON public.athlete_lifts(athlete_id, lift_type, is_current);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_lifts TO authenticated;
GRANT ALL ON public.athlete_lifts TO service_role;
ALTER TABLE public.athlete_lifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own lifts select" ON public.athlete_lifts FOR SELECT TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own lifts insert" ON public.athlete_lifts FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "own lifts update" ON public.athlete_lifts FOR UPDATE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own lifts delete" ON public.athlete_lifts FOR DELETE TO authenticated USING (auth.uid() = athlete_id);

-- 3. routine_templates
CREATE TABLE public.routine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  description TEXT,
  duration_weeks INT NOT NULL DEFAULT 4,
  split_type public.split_type NOT NULL DEFAULT 'full_body',
  days_per_week INT NOT NULL DEFAULT 3,
  difficulty_level public.difficulty_level NOT NULL DEFAULT 'beginner',
  target_audience TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.routine_templates TO authenticated, anon;
GRANT ALL ON public.routine_templates TO service_role;
ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public templates" ON public.routine_templates FOR SELECT TO authenticated, anon USING (is_public = true);

-- 4. template_days
CREATE TABLE public.template_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.routine_templates(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  day_title TEXT NOT NULL DEFAULT '',
  is_rest_day BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX template_days_template_idx ON public.template_days(template_id, week_number, day_of_week);
GRANT SELECT ON public.template_days TO authenticated, anon;
GRANT ALL ON public.template_days TO service_role;
ALTER TABLE public.template_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public template_days" ON public.template_days FOR SELECT TO authenticated, anon USING (true);

-- 5. template_exercises
CREATE TABLE public.template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_day_id UUID NOT NULL REFERENCES public.template_days(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  lift_type public.lift_type NOT NULL,
  base_sets INT NOT NULL DEFAULT 3,
  base_reps INT NOT NULL DEFAULT 5,
  base_intensity_percent INT,
  fixed_weight NUMERIC,
  priority INT NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  order_index INT NOT NULL DEFAULT 0,
  note TEXT
);
CREATE INDEX template_exercises_day_idx ON public.template_exercises(template_day_id, order_index);
GRANT SELECT ON public.template_exercises TO authenticated, anon;
GRANT ALL ON public.template_exercises TO service_role;
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public template_exercises" ON public.template_exercises FOR SELECT TO authenticated, anon USING (true);

-- 6. athlete_active_template
CREATE TABLE public.athlete_active_template (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.routine_templates(id) ON DELETE CASCADE,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_week INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX athlete_active_template_idx ON public.athlete_active_template(athlete_id, is_active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.athlete_active_template TO authenticated;
GRANT ALL ON public.athlete_active_template TO service_role;
ALTER TABLE public.athlete_active_template ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own active select" ON public.athlete_active_template FOR SELECT TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own active insert" ON public.athlete_active_template FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "own active update" ON public.athlete_active_template FOR UPDATE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own active delete" ON public.athlete_active_template FOR DELETE TO authenticated USING (auth.uid() = athlete_id);

-- 7. daily_checkins
CREATE TABLE public.daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sport_intensity INT NOT NULL CHECK (sport_intensity BETWEEN 1 AND 5),
  fatigue_level INT NOT NULL CHECK (fatigue_level BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkin select" ON public.daily_checkins FOR SELECT TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own checkin insert" ON public.daily_checkins FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "own checkin update" ON public.daily_checkins FOR UPDATE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own checkin delete" ON public.daily_checkins FOR DELETE TO authenticated USING (auth.uid() = athlete_id);

-- 8. workout_logs
CREATE TABLE public.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  template_exercise_id UUID REFERENCES public.template_exercises(id) ON DELETE SET NULL,
  exercise_name TEXT NOT NULL,
  planned_sets INT NOT NULL,
  planned_reps INT NOT NULL,
  planned_weight NUMERIC NOT NULL,
  actual_sets INT,
  actual_reps INT,
  actual_weight NUMERIC,
  completed BOOLEAN NOT NULL DEFAULT false,
  skipped BOOLEAN NOT NULL DEFAULT false,
  rpe INT CHECK (rpe BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX workout_logs_athlete_date_idx ON public.workout_logs(athlete_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own log select" ON public.workout_logs FOR SELECT TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own log insert" ON public.workout_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "own log update" ON public.workout_logs FOR UPDATE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own log delete" ON public.workout_logs FOR DELETE TO authenticated USING (auth.uid() = athlete_id);
