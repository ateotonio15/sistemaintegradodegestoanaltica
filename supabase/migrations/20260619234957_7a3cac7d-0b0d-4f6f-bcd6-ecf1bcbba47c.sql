
CREATE OR REPLACE FUNCTION public.ensure_plantao_empresa(p_nome text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_nome text := btrim(p_nome);
BEGIN
  IF v_nome IS NULL OR v_nome = '' THEN
    RAISE EXCEPTION 'Nome da empresa é obrigatório';
  END IF;

  SELECT id INTO v_id FROM public.plantoes_empresas WHERE lower(nome) = lower(v_nome) LIMIT 1;
  IF v_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plantoes_empresas WHERE id = v_id AND ativo = true) THEN
      UPDATE public.plantoes_empresas SET ativo = true WHERE id = v_id;
    END IF;
    RETURN v_id;
  END IF;

  INSERT INTO public.plantoes_empresas (nome, ativo) VALUES (v_nome, true) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_plantao_empresa(text) TO authenticated;
