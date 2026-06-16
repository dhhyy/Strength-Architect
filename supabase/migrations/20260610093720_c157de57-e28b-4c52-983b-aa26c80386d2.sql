ALTER TABLE public.athlete_routine_assignments
  ADD COLUMN IF NOT EXISTS goal_type text,
  ADD COLUMN IF NOT EXISTS season_phase text,
  ADD COLUMN IF NOT EXISTS sport_training_load text,
  ADD COLUMN IF NOT EXISTS desired_lifting_days integer,
  ADD COLUMN IF NOT EXISTS preferred_weekdays integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS competition_date date,
  ADD COLUMN IF NOT EXISTS routine_type text;