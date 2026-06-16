
-- 1) user_subscriptions
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  user_id UUID PRIMARY KEY,
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  trial_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  paid_plan_type TEXT,
  payment_provider TEXT,
  payment_status TEXT,
  access_expires_at TIMESTAMPTZ,
  is_admin_override BOOLEAN NOT NULL DEFAULT false,
  admin_override_reason TEXT,
  last_access_check_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_status_chk
    CHECK (subscription_status IN ('trialing','active','expired','canceled','admin_override'))
);

GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;
GRANT ALL ON public.user_subscriptions TO service_role;

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own subscription select"
  ON public.user_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "own subscription insert"
  ON public.user_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin manage subscriptions"
  ON public.user_subscriptions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER user_subscriptions_updated
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Extend handle_new_user to also start a 7-day trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name',''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
  VALUES (NEW.id, 'trialing', now(), now() + INTERVAL '7 days')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Backfill existing users
INSERT INTO public.user_subscriptions (user_id, subscription_status, trial_started_at, trial_ends_at)
SELECT p.id, 'trialing', now(), now() + INTERVAL '7 days'
FROM public.profiles p
LEFT JOIN public.user_subscriptions s ON s.user_id = p.id
WHERE s.user_id IS NULL;

-- 4) Hide duplicate routine templates (keep the 4 canonical ones)
UPDATE public.routine_templates
SET is_public = false
WHERE template_name IN (
  '주3회 전신훈련',
  '주 5회 나눔 - 종목훈련 병행용 - 8주 (복사)'
);
