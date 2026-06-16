
-- 1) 기존 템플릿 데이터 전체 삭제 (FK 없으므로 순서대로)
DELETE FROM public.template_exercises;
DELETE FROM public.template_days;
DELETE FROM public.athlete_active_template;
DELETE FROM public.routine_templates;

-- 2) split_type enum 재구성
ALTER TABLE public.routine_templates ALTER COLUMN split_type DROP DEFAULT;
ALTER TABLE public.routine_templates ALTER COLUMN split_type TYPE text USING split_type::text;
DROP TYPE IF EXISTS public.split_type;
CREATE TYPE public.split_type AS ENUM ('full_body_3','full_body_4','upper_lower_4','five_split_5','custom');
ALTER TABLE public.routine_templates
  ALTER COLUMN split_type TYPE public.split_type USING split_type::public.split_type;
ALTER TABLE public.routine_templates ALTER COLUMN split_type SET DEFAULT 'full_body_3'::public.split_type;
ALTER TABLE public.routine_templates ALTER COLUMN duration_weeks SET DEFAULT 8;

-- 3) lift_type enum에 'accessory' 추가
ALTER TYPE public.lift_type ADD VALUE IF NOT EXISTS 'accessory';

-- 4) routine_templates: 관리자 쓰기 권한
GRANT INSERT, UPDATE, DELETE ON public.routine_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.template_days TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.template_exercises TO authenticated;

DROP POLICY IF EXISTS "admin write templates" ON public.routine_templates;
CREATE POLICY "admin write templates" ON public.routine_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin write template_days" ON public.template_days;
CREATE POLICY "admin write template_days" ON public.template_days
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin write template_exercises" ON public.template_exercises;
CREATE POLICY "admin write template_exercises" ON public.template_exercises
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5) daily_routines 테이블
CREATE TABLE public.daily_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  template_day_id uuid,
  adjusted_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_modified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_routines TO authenticated;
GRANT ALL ON public.daily_routines TO service_role;

ALTER TABLE public.daily_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own daily routines all" ON public.daily_routines
  FOR ALL TO authenticated
  USING (auth.uid() = athlete_id)
  WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "coach view member daily routines" ON public.daily_routines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.teams t ON tm.team_id = t.id
    WHERE tm.athlete_id = daily_routines.athlete_id
      AND t.coach_id = auth.uid()
      AND tm.is_active
  ));

CREATE INDEX idx_daily_routines_athlete_date ON public.daily_routines(athlete_id, date DESC);
