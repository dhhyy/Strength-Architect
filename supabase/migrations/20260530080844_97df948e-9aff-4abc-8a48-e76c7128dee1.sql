GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_team_member(uuid, uuid) TO anon, authenticated;