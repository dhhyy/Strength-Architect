CREATE TABLE public.neural_budget_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_score numeric NOT NULL DEFAULT 0,
  sport_score numeric NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.neural_budget_daily TO authenticated;
GRANT ALL ON public.neural_budget_daily TO service_role;

ALTER TABLE public.neural_budget_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own nb select" ON public.neural_budget_daily FOR SELECT TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own nb insert" ON public.neural_budget_daily FOR INSERT TO authenticated WITH CHECK (auth.uid() = athlete_id);
CREATE POLICY "own nb update" ON public.neural_budget_daily FOR UPDATE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "own nb delete" ON public.neural_budget_daily FOR DELETE TO authenticated USING (auth.uid() = athlete_id);
CREATE POLICY "coach view nb" ON public.neural_budget_daily FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM team_members tm JOIN teams t ON t.id = tm.team_id
    WHERE tm.athlete_id = neural_budget_daily.athlete_id AND t.coach_id = auth.uid() AND tm.is_active));

CREATE TRIGGER trg_nb_updated BEFORE UPDATE ON public.neural_budget_daily
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();