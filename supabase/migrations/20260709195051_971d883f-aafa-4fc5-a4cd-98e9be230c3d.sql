CREATE OR REPLACE FUNCTION public.ensure_plantao_empresa(_id uuid, _nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.plantoes_empresas (id, nome, ativo)
  VALUES (_id, _nome, true)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, ativo = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_plantao_empresa(uuid, text) TO authenticated;