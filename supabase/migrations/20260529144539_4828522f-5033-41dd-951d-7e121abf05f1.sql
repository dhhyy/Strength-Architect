ALTER TABLE public.daily_routines
  ADD COLUMN IF NOT EXISTS planned_date date,
  ADD COLUMN IF NOT EXISTS executed_date date;

UPDATE public.daily_routines
SET planned_date = COALESCE(planned_date, date),
    executed_date = COALESCE(executed_date, date)
WHERE planned_date IS NULL OR executed_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_routines_planned_date
  ON public.daily_routines (athlete_id, planned_date);
CREATE INDEX IF NOT EXISTS idx_daily_routines_executed_date
  ON public.daily_routines (athlete_id, executed_date);