REVOKE ALL ON FUNCTION public.normalize_admin_movimentacao_periodo() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_admin_movimentacao_periodo() FROM anon;
GRANT EXECUTE ON FUNCTION public.normalize_admin_movimentacao_periodo() TO service_role;