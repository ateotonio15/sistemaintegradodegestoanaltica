
-- Permitir Vendas excluir qualquer implantação
CREATE POLICY "Vendas delete implantacoes"
ON public.implantacoes_contratos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'vendas'::app_role));

-- RPC para excluir com cascata
CREATE OR REPLACE FUNCTION public.excluir_implantacao(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paths text[];
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'vendas'::app_role)) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  SELECT COALESCE(array_agg(storage_path), ARRAY[]::text[])
    INTO v_paths
  FROM public.implantacao_anexos
  WHERE implantacao_id = p_id;

  DELETE FROM public.implantacao_alertas WHERE implantacao_id = p_id;
  DELETE FROM public.implantacao_logs WHERE implantacao_id = p_id;
  DELETE FROM public.implantacao_anexos WHERE implantacao_id = p_id;
  DELETE FROM public.implantacoes_contratos WHERE id = p_id;

  RETURN jsonb_build_object('storage_paths', v_paths);
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_implantacao(uuid) TO authenticated;
