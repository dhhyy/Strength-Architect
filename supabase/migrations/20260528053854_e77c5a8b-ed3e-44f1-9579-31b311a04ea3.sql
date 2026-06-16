CREATE OR REPLACE FUNCTION public.profile_protected_fields_match(_uid uuid, _role public.user_role, _is_admin boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _uid
      AND role = _role
      AND is_admin = _is_admin
  );
$$;

DROP POLICY IF EXISTS "self insert" ON public.profiles;
DROP POLICY IF EXISTS "self select" ON public.profiles;
DROP POLICY IF EXISTS "self update" ON public.profiles;
DROP POLICY IF EXISTS "self delete" ON public.profiles;

CREATE POLICY "self select"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "self insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = id) AND (is_admin = false));

CREATE POLICY "self update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK ((auth.uid() = id) AND public.profile_protected_fields_match(auth.uid(), role, is_admin));

CREATE POLICY "self delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "own lifts select" ON public.athlete_lifts;
DROP POLICY IF EXISTS "own lifts insert" ON public.athlete_lifts;
DROP POLICY IF EXISTS "own lifts update" ON public.athlete_lifts;
DROP POLICY IF EXISTS "own lifts delete" ON public.athlete_lifts;

CREATE POLICY "own lifts select"
ON public.athlete_lifts
FOR SELECT
TO authenticated
USING (auth.uid() = athlete_id);

CREATE POLICY "own lifts insert"
ON public.athlete_lifts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "own lifts update"
ON public.athlete_lifts
FOR UPDATE
TO authenticated
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "own lifts delete"
ON public.athlete_lifts
FOR DELETE
TO authenticated
USING (auth.uid() = athlete_id);

DROP POLICY IF EXISTS "own active select" ON public.athlete_active_template;
DROP POLICY IF EXISTS "own active insert" ON public.athlete_active_template;
DROP POLICY IF EXISTS "own active update" ON public.athlete_active_template;
DROP POLICY IF EXISTS "own active delete" ON public.athlete_active_template;

CREATE POLICY "own active select"
ON public.athlete_active_template
FOR SELECT
TO authenticated
USING (auth.uid() = athlete_id);

CREATE POLICY "own active insert"
ON public.athlete_active_template
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "own active update"
ON public.athlete_active_template
FOR UPDATE
TO authenticated
USING (auth.uid() = athlete_id)
WITH CHECK (auth.uid() = athlete_id);

CREATE POLICY "own active delete"
ON public.athlete_active_template
FOR DELETE
TO authenticated
USING (auth.uid() = athlete_id);