
-- Remove anonymous policies that exposed all rows and allowed unrestricted updates
DROP POLICY IF EXISTS "Acesso anônimo por token para leitura" ON public.avaliacoes_envios;
DROP POLICY IF EXISTS "Acesso anônimo por token para atualizar resposta" ON public.avaliacoes_envios;

-- Revoke direct table grants from anon
REVOKE SELECT, UPDATE ON public.avaliacoes_envios FROM anon;

-- SECURITY DEFINER RPC: fetch a single envio by token (only if not yet answered)
CREATE OR REPLACE FUNCTION public.get_avaliacao_envio_por_token(p_token text)
RETURNS TABLE(
  id uuid,
  empresa_id uuid,
  empresa_nome text,
  executiva_nome text,
  data_resposta timestamptz,
  formulario_id uuid,
  mes_referencia text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.empresa_id, e.empresa_nome, e.executiva_nome, e.data_resposta, e.formulario_id, e.mes_referencia
  FROM public.avaliacoes_envios e
  WHERE e.token_unico = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_avaliacao_envio_por_token(text) TO anon, authenticated;

-- SECURITY DEFINER RPC: submit a response using the token (atomic insert + update)
CREATE OR REPLACE FUNCTION public.responder_avaliacao_por_token(
  p_token text,
  p_respostas jsonb,
  p_comentario text,
  p_nota_media numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env record;
  v_form_id uuid;
  v_resp_id uuid;
BEGIN
  SELECT id, empresa_nome, executiva_nome, formulario_id, data_resposta
    INTO v_env
  FROM public.avaliacoes_envios
  WHERE token_unico = p_token
  LIMIT 1;

  IF v_env.id IS NULL THEN
    RAISE EXCEPTION 'Link inválido';
  END IF;
  IF v_env.data_resposta IS NOT NULL THEN
    RAISE EXCEPTION 'Avaliação já respondida';
  END IF;

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
     v_env.empresa_nome, v_env.executiva_nome, v_env.id)
  RETURNING id INTO v_resp_id;

  UPDATE public.avaliacoes_envios
     SET data_resposta = now(),
         status = 'respondido',
         resposta_id = v_resp_id,
         updated_at = now()
   WHERE id = v_env.id;

  RETURN v_resp_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.responder_avaliacao_por_token(text, jsonb, text, numeric) TO anon, authenticated;
