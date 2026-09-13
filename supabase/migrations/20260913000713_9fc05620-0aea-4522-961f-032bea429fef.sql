REVOKE ALL ON FUNCTION public.contrato_processo_hist_imutavel() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.contrato_processo_pendencia_log() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.implantacao_anexo_log_processo() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.implantacao_log_analises() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.contrato_processo_log_mudancas() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public._log_processo_evento(uuid, text, text, jsonb) FROM anon, authenticated;