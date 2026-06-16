
CREATE TABLE IF NOT EXISTS public.template_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  template_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_assignments TO authenticated;
GRANT ALL ON public.template_assignments TO service_role;

ALTER TABLE public.template_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all assignments" ON public.template_assignments;
CREATE POLICY "admin all assignments" ON public.template_assignments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "athlete read own assignments" ON public.template_assignments;
CREATE POLICY "athlete read own assignments" ON public.template_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = athlete_id);

-- Allow admins to view all profiles for the assignment picker
DROP POLICY IF EXISTS "admin read all profiles" ON public.profiles;
CREATE POLICY "admin read all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin can manage anyone's active template (for assignment)
DROP POLICY IF EXISTS "admin manage active template" ON public.athlete_active_template;
CREATE POLICY "admin manage active template" ON public.athlete_active_template
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
