
CREATE OR REPLACE FUNCTION public.is_team_coach(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND coach_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_active_team_member(_team_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = _team_id AND athlete_id = _user_id AND is_active);
$$;

DROP POLICY IF EXISTS "coach view team members" ON public.team_members;
CREATE POLICY "coach view team members" ON public.team_members FOR SELECT TO authenticated
USING (public.is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coach delete team members" ON public.team_members;
CREATE POLICY "coach delete team members" ON public.team_members FOR DELETE TO authenticated
USING (public.is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "team members read team" ON public.teams;
CREATE POLICY "team members read team" ON public.teams FOR SELECT TO authenticated
USING (public.is_active_team_member(id, auth.uid()));
