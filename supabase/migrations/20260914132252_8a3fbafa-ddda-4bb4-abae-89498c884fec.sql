CREATE OR REPLACE FUNCTION public.responder_avaliacao_por_token(p_token text, p_respostas jsonb, p_comentario text, p_nota_media numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_env record;
  v_form_id uuid;
  v_resp_id uuid;
  v_exec text;
BEGIN
  SELECT e.id, e.empresa_id, e.empresa_nome, e.executiva_nome, e.formulario_id, e.data_resposta,
         COALESCE(p.display_name, e.executiva_nome) AS exec_atual
    INTO v_env
  FROM public.avaliacoes_envios e
  LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.profiles p ON p.user_id = emp.executiva_user_id
  WHERE e.token_unico = p_token
  LIMIT 1;

  IF v_env.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;

  v_exec := v_env.exec_atual;
  v_form_id := v_env.formulario_id;
  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id FROM public.cs_avaliacao_formularios
     WHERE tipo = 'rh' ORDER BY created_at DESC LIMIT 1;
  END IF;

  INSERT INTO public.cs_avaliacao_respostas
    (formulario_id, respostas, nota_media, comentario, nome_empresa, nome_executiva, envio_id)
  VALUES
    (v_form_id, COALESCE(p_respostas, '{}'::jsonb), p_nota_media,
     NULLIF(trim(COALESCE(p_comentario,'')), ''),
     v_env.empresa_nome, v_exec, v_env.id)
  RETURNING id INTO v_resp_id;

  UPDATE public.avaliacoes_envios
     SET data_resposta = COALESCE(data_resposta, now()),
         status = 'respondido',
         resposta_id = COALESCE(resposta_id, v_resp_id),
         updated_at = now()
   WHERE id = v_env.id;

  RETURN v_resp_id;
END;
$function$;