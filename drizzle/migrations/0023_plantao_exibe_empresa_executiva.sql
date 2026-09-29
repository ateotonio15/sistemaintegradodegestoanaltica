CREATE OR REPLACE FUNCTION public.get_avaliacao_plantao_detalhes_por_token(p_token text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'id', e.id,
    'unidade', e.unidade,
    'empresa_nome', e.empresa_nome,
    'executiva_nome', CASE
      WHEN public.empresa_sem_executiva_unica(e.empresa_id) THEN NULL
      ELSE e.executiva_nome
    END,
    'permite_informar_executiva', public.empresa_sem_executiva_unica(e.empresa_id),
    'formulario_id', f.id,
    'titulo', f.titulo,
    'instrucoes', f.instrucoes,
    'perguntas', f.perguntas
  )
  FROM public.avaliacoes_envios e
  JOIN public.cs_avaliacao_formularios f
    ON f.id = COALESCE(
      e.formulario_id,
      (SELECT id FROM public.cs_avaliacao_formularios WHERE tipo = 'plantao' ORDER BY created_at DESC LIMIT 1)
    )
  WHERE e.token_unico = p_token
    AND e.tipo = 'plantao'
    AND e.ativo
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_avaliacao_plantao_detalhes_por_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_avaliacao_plantao_detalhes_por_token(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.responder_avaliacao_plantao_com_executiva_por_token(
  p_token text,
  p_respostas jsonb,
  p_comentario text,
  p_nota_media numeric,
  p_data_atendimento date,
  p_unidade text,
  p_executiva_informada text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_env record;
  v_form uuid;
  v_id uuid;
  v_sem_executiva_unica boolean;
  v_nome_executiva text;
BEGIN
  SELECT * INTO v_env
  FROM public.avaliacoes_envios
  WHERE token_unico = p_token AND tipo = 'plantao' AND ativo
  LIMIT 1;

  IF v_env.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  v_form := COALESCE(
    v_env.formulario_id,
    (SELECT id FROM public.cs_avaliacao_formularios WHERE tipo = 'plantao' ORDER BY created_at DESC LIMIT 1)
  );
  v_sem_executiva_unica := public.empresa_sem_executiva_unica(v_env.empresa_id);

  IF p_data_atendimento IS NOT NULL AND p_data_atendimento > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'Data do atendimento inválida';
  END IF;

  IF v_sem_executiva_unica THEN
    v_nome_executiva := NULLIF(left(upper(trim(COALESCE(p_executiva_informada, ''))), 120), '');
    IF v_nome_executiva IS NULL THEN
      RAISE EXCEPTION 'Informe o nome da executiva avaliada';
    END IF;
  ELSE
    v_nome_executiva := v_env.executiva_nome;
  END IF;

  INSERT INTO public.cs_avaliacao_respostas
    (formulario_id, tipo, respostas, nota_media, comentario, nome_empresa, nome_executiva, envio_id, data_atendimento, unidade)
  VALUES (
    v_form,
    'plantao',
    COALESCE(p_respostas, '{}'::jsonb),
    p_nota_media,
    NULLIF(left(trim(COALESCE(p_comentario, '')), 2000), ''),
    v_env.empresa_nome,
    v_nome_executiva,
    v_env.id,
    p_data_atendimento,
    COALESCE(NULLIF(left(trim(COALESCE(p_unidade, '')), 160), ''), v_env.unidade)
  )
  RETURNING id INTO v_id;

  UPDATE public.avaliacoes_envios
  SET data_resposta = now(), updated_at = now()
  WHERE id = v_env.id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.responder_avaliacao_plantao_com_executiva_por_token(text, jsonb, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.responder_avaliacao_plantao_com_executiva_por_token(text, jsonb, text, numeric, date, text, text) TO anon, authenticated, service_role;