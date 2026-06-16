ALTER TABLE public.athlete_routine_assignments
  ADD COLUMN IF NOT EXISTS sport_training_stress_level text,
  ADD COLUMN IF NOT EXISTS strength_training_tolerance text,
  ADD COLUMN IF NOT EXISTS current_goal text,
  ADD COLUMN IF NOT EXISTS competition_weeks_out integer,
  ADD COLUMN IF NOT EXISTS weekly_program_mode text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS priority_focus_1 text,
  ADD COLUMN IF NOT EXISTS priority_focus_2 text,
  ADD COLUMN IF NOT EXISTS priority_focus_3 text,
  ADD COLUMN IF NOT EXISTS main_prescription_preference text DEFAULT 'fixed_sets',
  ADD COLUMN IF NOT EXISTS target_rep_zone text;