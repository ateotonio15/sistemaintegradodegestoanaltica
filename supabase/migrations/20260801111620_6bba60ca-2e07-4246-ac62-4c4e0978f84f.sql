CREATE OR REPLACE FUNCTION public.tem_movimentacao_pendente(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.movimentacoes m
     WHERE m.empresa_id = p_empresa_id
       AND m.data_envio_financeiro IS NULL
       AND m.mes_referencia >= to_char(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')
       AND (
         to_date(m.mes_referencia,'YYYY-MM')
         + (COALESCE(NULLIF(split_part(m.periodo,'-',2),'')::int, 30) - 1)
       ) < CURRENT_DATE
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes fm
     WHERE fm.empresa_id = p_empresa_id
       AND fm.data_envio_nota IS NULL
       AND fm.mes_referencia >= to_char(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')
       AND fm.mes_referencia < to_char(CURRENT_DATE,'YYYY-MM')
  );
$$;