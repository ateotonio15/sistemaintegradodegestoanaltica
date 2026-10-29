REVOKE ALL ON public.movimentacao_relatorio_envios FROM anon, authenticated;
GRANT SELECT ON public.movimentacao_relatorio_envios TO authenticated;
GRANT ALL ON public.movimentacao_relatorio_envios TO service_role;
CREATE FUNCTION public.bloquear_alteracao_envio_relatorio() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN RAISE EXCEPTION 'Historico de envios nao pode ser alterado ou excluido'; END; $$;
CREATE TRIGGER historico_envios_imutavel BEFORE UPDATE OR DELETE ON public.movimentacao_relatorio_envios FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao_envio_relatorio();