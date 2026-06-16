
-- 1) profiles: tighten self-update so role/is_admin cannot be escalated
DROP POLICY IF EXISTS "self update" ON public.profiles;
CREATE POLICY "self update" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND is_admin = false
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2) user_subscriptions: remove the unrestricted insert policy
DROP POLICY IF EXISTS "own subscription insert" ON public.user_subscriptions;

-- 3) teams: remove member SELECT policy so invite_code isn't exposed to athletes.
-- Coaches still get full access via the existing "coach teams all" policy.
DROP POLICY IF EXISTS "team members read team" ON public.teams;
