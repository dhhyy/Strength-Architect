
ALTER TABLE public.athlete_routine_assignments
  ADD COLUMN IF NOT EXISTS main_goal text,
  ADD COLUMN IF NOT EXISTS main_rep_low smallint,
  ADD COLUMN IF NOT EXISTS main_rep_high smallint;

ALTER TABLE public.daily_checkins
  ADD COLUMN IF NOT EXISTS condition text;
