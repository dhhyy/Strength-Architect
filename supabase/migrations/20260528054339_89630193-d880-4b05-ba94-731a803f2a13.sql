REVOKE ALL ON FUNCTION public.profile_protected_fields_match(uuid, public.user_role, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_protected_fields_match(uuid, public.user_role, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.profile_protected_fields_match(uuid, public.user_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_protected_fields_match(uuid, public.user_role, boolean) TO service_role;