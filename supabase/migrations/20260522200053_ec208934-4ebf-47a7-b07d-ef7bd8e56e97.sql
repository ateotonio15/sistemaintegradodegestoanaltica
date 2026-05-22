REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM anon, PUBLIC;
-- Mantém acesso para a service role (usada pela edge function resolve-username) e authenticated.
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated, service_role;