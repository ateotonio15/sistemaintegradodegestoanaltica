ALTER TABLE public.avaliacoes_envios ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rh';
ALTER TABLE public.avaliacoes_envios ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.avaliacoes_envios ADD COLUMN IF NOT EXISTS fixo boolean NOT NULL DEFAULT false;
ALTER TABLE public.avaliacoes_envios ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.cs_avaliacao_respostas ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'rh';
ALTER TABLE public.cs_avaliacao_respostas ADD COLUMN IF NOT EXISTS data_atendimento date;
ALTER TABLE public.cs_avaliacao_respostas ADD COLUMN IF NOT EXISTS unidade text;
UPDATE public.cs_avaliacao_formularios SET tipo = 'rh' WHERE tipo IS NULL;
ALTER TABLE public.cs_avaliacao_formularios ALTER COLUMN tipo SET DEFAULT 'rh';
ALTER TABLE public.avaliacoes_envios ADD CONSTRAINT avaliacoes_envios_tipo_chk CHECK (tipo IN ('rh','plantao'));
ALTER TABLE public.cs_avaliacao_respostas ADD CONSTRAINT cs_avaliacao_respostas_tipo_chk CHECK (tipo IN ('rh','plantao'));
CREATE INDEX IF NOT EXISTS idx_avaliacoes_envios_tipo ON public.avaliacoes_envios(tipo);
CREATE INDEX IF NOT EXISTS idx_cs_avaliacao_respostas_tipo ON public.cs_avaliacao_respostas(tipo);

CREATE OR REPLACE FUNCTION public.get_avaliacao_plantao_por_token(p_token text)
RETURNS TABLE(id uuid, unidade text, empresa_nome text, formulario_id uuid, titulo text, instrucoes text, perguntas jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id, e.unidade, e.empresa_nome, f.id, f.titulo, f.instrucoes, f.perguntas
  FROM public.avaliacoes_envios e
  JOIN public.cs_avaliacao_formularios f
    ON f.id = COALESCE(e.formulario_id, (SELECT id FROM public.cs_avaliacao_formularios WHERE tipo='plantao' ORDER BY created_at DESC LIMIT 1))
  WHERE e.token_unico = p_token AND e.tipo = 'plantao' AND e.ativo
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_avaliacao_plantao_por_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.responder_avaliacao_plantao_por_token(
  p_token text, p_respostas jsonb, p_comentario text, p_nota_media numeric,
  p_data_atendimento date, p_unidade text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_env record; v_form uuid; v_id uuid;
BEGIN
  SELECT * INTO v_env FROM public.avaliacoes_envios
   WHERE token_unico = p_token AND tipo = 'plantao' AND ativo LIMIT 1;
  IF v_env.id IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;
  v_form := COALESCE(v_env.formulario_id, (SELECT id FROM public.cs_avaliacao_formularios WHERE tipo='plantao' ORDER BY created_at DESC LIMIT 1));
  IF p_data_atendimento IS NOT NULL AND p_data_atendimento > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Data do atendimento inválida';
  END IF;
  INSERT INTO public.cs_avaliacao_respostas
    (formulario_id, tipo, respostas, nota_media, comentario, nome_empresa, envio_id, data_atendimento, unidade)
  VALUES (v_form, 'plantao', COALESCE(p_respostas,'{}'::jsonb), p_nota_media,
    NULLIF(left(trim(COALESCE(p_comentario,'')),2000),''), v_env.empresa_nome, v_env.id,
    p_data_atendimento, COALESCE(NULLIF(left(trim(COALESCE(p_unidade,'')),160),''), v_env.unidade))
  RETURNING id INTO v_id;
  UPDATE public.avaliacoes_envios SET data_resposta = now(), updated_at = now() WHERE id = v_env.id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.responder_avaliacao_plantao_por_token(text, jsonb, text, numeric, date, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.processar_avaliacoes_envios()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg record; v_form_id uuid; v_mes text := to_char(CURRENT_DATE, 'YYYY-MM');
  v_criados int := 0; v_lembretes int := 0; v_emp record;
BEGIN
  SELECT * INTO v_cfg FROM public.avaliacoes_config LIMIT 1;
  IF v_cfg IS NULL THEN RETURN jsonb_build_object('erro','sem config'); END IF;
  v_form_id := v_cfg.formulario_id;
  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id FROM public.cs_avaliacao_formularios WHERE tipo='rh' ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_cfg.envio_mensal_ativo AND EXTRACT(DAY FROM CURRENT_DATE)::int >= v_cfg.dia_envio THEN
    FOR v_emp IN
      SELECT e.id, e.nome, e.email_empresa, e.responsavel_user_id, e.responsavel_contrato
        FROM public.empresas e
       WHERE e.status_empresa = 'Ativa' AND e.tipo_contrato = 'EMPRESARIAL'
         AND e.data_implantacao <= CURRENT_DATE AND e.data_rescisao IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.avaliacoes_envios ae
            WHERE ae.empresa_id = e.id AND ae.mes_referencia = v_mes AND ae.tipo = 'rh')
    LOOP
      INSERT INTO public.avaliacoes_envios
        (empresa_id, empresa_nome, email_destino, status, formulario_id, mes_referencia, executiva_user_id, executiva_nome, tipo)
      VALUES (v_emp.id, v_emp.nome, COALESCE(v_emp.email_empresa,''), 'pendente_envio', v_form_id, v_mes,
         v_emp.responsavel_user_id, v_emp.responsavel_contrato, 'rh');
      v_criados := v_criados + 1;
    END LOOP;
  END IF;
  IF v_cfg.lembrete_ativo THEN
    UPDATE public.avaliacoes_envios SET status = 'lembrete', lembrete_enviado_em = now(), updated_at = now()
     WHERE tipo = 'rh' AND data_resposta IS NULL AND lembrete_enviado_em IS NULL
       AND status IN ('enviado','pendente_envio')
       AND data_envio <= now() - (v_cfg.dias_para_lembrete || ' days')::interval;
    GET DIAGNOSTICS v_lembretes = ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('mes', v_mes, 'envios_criados', v_criados, 'lembretes_marcados', v_lembretes);
END $function$;