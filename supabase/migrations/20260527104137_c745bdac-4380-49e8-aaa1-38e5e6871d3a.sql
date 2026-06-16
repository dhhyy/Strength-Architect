
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random()*length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END;$$;

REVOKE EXECUTE ON FUNCTION public.gen_invite_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gen_invite_code() TO authenticated, service_role;

-- Also set search_path on update_answer_likes_count (keep SECURITY DEFINER since trigger needs to bypass RLS on qna_answers, but lock execute)
REVOKE EXECUTE ON FUNCTION public.update_answer_likes_count() FROM PUBLIC, anon, authenticated;
