CREATE OR REPLACE FUNCTION public.nfse_central_despertar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u text; t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.nfse_recebimentos WHERE estado IN
    ('recebido_pendente','aguardando_faturado','aguardando_faturamento_anexado','destino_ambiguo','aguardando_validacao','validacao_inconclusiva','divergencia','aprovado_aguardando_liberacao')) THEN
    RETURN NULL;
  END IF;
  SELECT valor INTO u FROM public.config_sync WHERE chave = 'nfse_central_url';
  SELECT valor INTO t FROM public.config_sync WHERE chave = 'nfse_central_token';
  IF u IS NULL OR t IS NULL THEN RETURN NULL; END IF;
  BEGIN
    PERFORM net.http_post(url := u, headers := jsonb_build_object('Content-Type','application/json','x-sync-token',t), body := '{}'::jsonb, timeout_milliseconds := 120000);
  EXCEPTION WHEN OTHERS THEN NULL; -- nunca bloqueia a gravação original
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.nfse_central_despertar() FROM public, anon, authenticated;

CREATE TRIGGER trg_nfse_central_despertar_receb AFTER INSERT ON public.nfse_recebimentos
  FOR EACH STATEMENT EXECUTE FUNCTION public.nfse_central_despertar();
CREATE TRIGGER trg_nfse_central_despertar_anexos AFTER INSERT OR UPDATE OR DELETE ON public.anexos_financeiro
  FOR EACH STATEMENT EXECUTE FUNCTION public.nfse_central_despertar();
CREATE TRIGGER trg_nfse_central_despertar_movs AFTER UPDATE OF data_envio_nota, tipo_analise ON public.financeiro_movimentacoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.nfse_central_despertar();
CREATE TRIGGER trg_nfse_central_despertar_pag AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_pagadores
  FOR EACH STATEMENT EXECUTE FUNCTION public.nfse_central_despertar();