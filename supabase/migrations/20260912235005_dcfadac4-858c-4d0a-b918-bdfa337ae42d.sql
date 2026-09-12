REVOKE EXECUTE ON FUNCTION public.encaminhar_contrato_processo(uuid, text, text, uuid, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_movimentacao_processo(uuid, text, text, text, text, uuid, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_movimentacao_processo(uuid, text, text, text, text, uuid, text, text, jsonb, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.criar_contrato_processo(uuid, uuid, text, text) FROM anon, authenticated;