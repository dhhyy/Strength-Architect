DELETE FROM public.exercise_library
WHERE exercise_name NOT IN ('백스쿼트', '데드리프트', '벤치프레스', '오버헤드프레스', '파워클린', '풀업', '딥스');

GRANT INSERT, UPDATE, DELETE ON public.exercise_library TO authenticated;
GRANT ALL ON public.exercise_library TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exercise_library'
      AND policyname = 'admin manage exercise library'
  ) THEN
    CREATE POLICY "admin manage exercise library"
    ON public.exercise_library
    FOR ALL
    TO authenticated
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;