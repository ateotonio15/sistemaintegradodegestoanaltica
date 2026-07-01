CREATE OR REPLACE FUNCTION public.responder_avaliacao_publica(
  p_formulario_id uuid,
  p_respostas jsonb,
  p_comentario text,
  p_nota_media numeric,
  p_nome_empresa text,
  p_nome_executiva text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_formulario_id IS NULL THEN
    RAISE EXCEPTION 'Formulário inválido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cs_avaliacao_formularios WHERE id = p_formulario_id) THEN
    RAISE EXCEPTION 'Formulário não encontrado';
  END IF;
  IF coalesce(trim(p_nome_empresa),'') = '' OR coalesce(trim(p_nome_executiva),'') = '' THEN
    RAISE EXCEPTION 'Empresa e executiva são obrigatórias';
  END IF;

  INSERT INTO public.cs_avaliacao_respostas
    (formulario_id, respostas, nota_media, comentario, nome_empresa, nome_executiva)
  VALUES
    (p_formulario_id, COALESCE(p_respostas, '{}'::jsonb), p_nota_media,
     NULLIF(trim(COALESCE(p_comentario,'')), ''),
     trim(p_nome_empresa), trim(p_nome_executiva))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.responder_avaliacao_publica(uuid, jsonb, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.responder_avaliacao_publica(uuid, jsonb, text, numeric, text, text) TO anon, authenticated;