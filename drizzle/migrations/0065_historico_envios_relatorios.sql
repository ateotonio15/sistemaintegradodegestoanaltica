CREATE TABLE public.movimentacao_relatorio_envios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 envio_id uuid NOT NULL,
 movimentacao_id uuid NOT NULL,
 principal_movimentacao_id uuid NOT NULL,
 enviado_em timestamptz NOT NULL DEFAULT now(),
 enviado_por uuid NOT NULL,
 nome_remetente text,
 UNIQUE(envio_id, movimentacao_id)
);
GRANT SELECT ON public.movimentacao_relatorio_envios TO authenticated;
GRANT ALL ON public.movimentacao_relatorio_envios TO service_role;
ALTER TABLE public.movimentacao_relatorio_envios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consultar envios conforme movimentacao" ON public.movimentacao_relatorio_envios FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE INDEX movimentacao_relatorio_envios_consulta ON public.movimentacao_relatorio_envios(movimentacao_id, enviado_em DESC);
CREATE FUNCTION public.registrar_envio_relatorio_concluido(p_envio_id uuid, p_principal uuid, p_movimentacoes uuid[], p_usuario uuid, p_nome text, p_destinatarios text, p_cc text, p_contrato text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_agora timestamptz := clock_timestamp(); v_hoje date := (v_agora AT TIME ZONE 'America/Manaus')::date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = p_usuario AND role IN ('admin','comum','administradoras')) THEN RAISE EXCEPTION 'Sem permissao para registrar envio'; END IF;
 IF NOT p_principal = ANY(p_movimentacoes) OR cardinality(p_movimentacoes) = 0 THEN RAISE EXCEPTION 'Movimentacoes invalidas'; END IF;
 FOR v_id IN SELECT DISTINCT unnest(p_movimentacoes) ORDER BY 1 LOOP
  PERFORM 1 FROM public.movimentacoes WHERE id = v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimentacao nao encontrada'; END IF;
  IF EXISTS(SELECT 1 FROM public.movimentacao_relatorio_envios WHERE envio_id = p_envio_id AND movimentacao_id = v_id) THEN CONTINUE; END IF;
  INSERT INTO public.movimentacao_relatorio_envios(envio_id,movimentacao_id,principal_movimentacao_id,enviado_em,enviado_por,nome_remetente) VALUES(p_envio_id,v_id,p_principal,v_agora,p_usuario,NULLIF(trim(p_nome),''));
  INSERT INTO public.movimentacao_relatorios(movimentacao_id,status,destinatarios,cc,data_envio,confirmacao,observacoes) VALUES(v_id,'Enviado',p_destinatarios,p_cc,v_hoje,'Aguardando',CASE WHEN v_id <> p_principal THEN 'Enviado junto com o contrato principal #' || p_contrato ELSE '' END)
  ON CONFLICT(movimentacao_id) DO UPDATE SET status='Enviado',destinatarios=EXCLUDED.destinatarios,cc=EXCLUDED.cc,data_envio=EXCLUDED.data_envio,confirmacao='Aguardando',observacoes=CASE WHEN v_id <> p_principal THEN EXCLUDED.observacoes ELSE movimentacao_relatorios.observacoes END;
  UPDATE public.movimentacoes SET data_envio_empresa=v_hoje WHERE id=v_id AND data_envio_empresa IS NULL;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.registrar_envio_relatorio_concluido(uuid,uuid,uuid[],uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_envio_relatorio_concluido(uuid,uuid,uuid[],uuid,text,text,text,text) TO service_role;
COMMENT ON TABLE public.movimentacao_relatorio_envios IS 'Historico imutavel de emails aceitos pelo servidor; gravacao exclusiva do servidor apos SMTP. Datas antigas permanecem em movimentacoes.data_envio_empresa sem horarios inferidos.';