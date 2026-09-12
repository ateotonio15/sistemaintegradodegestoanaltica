CREATE OR REPLACE FUNCTION public.contrato_processo_pendencia_bloquear_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Pendências não podem ser excluídas. Use o status Cancelada.';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.contrato_processo_pendencia_bloquear_delete() FROM anon, authenticated;