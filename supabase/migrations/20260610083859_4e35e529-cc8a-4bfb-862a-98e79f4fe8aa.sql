
-- Ensure profiles privilege change trigger is attached
DROP TRIGGER IF EXISTS prevent_profile_privilege_change_trg ON public.profiles;
CREATE TRIGGER prevent_profile_privilege_change_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_change();

-- Restrict user_subscriptions INSERT so users cannot grant themselves access
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "users insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users insert own subscription" ON public.user_subscriptions;

CREATE POLICY "Users can insert own trialing subscription"
  ON public.user_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND subscription_status = 'trialing'
    AND COALESCE(is_admin_override, false) = false
    AND admin_override_reason IS NULL
    AND access_expires_at IS NULL
  );
