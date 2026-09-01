CREATE OR REPLACE FUNCTION public._periodo_para_empresa(p_empresa empresas)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_empresa.data_corte IS NOT NULL
         AND (p_empresa.tipo_contrato = 'ADMINISTRADORA'
              OR p_empresa.tipo_movimentacao = 'Diária'
              OR COALESCE(p_empresa.periodo_movimentacao, '') = '') THEN
      CASE
        WHEN p_empresa.data_corte <= 5 THEN '01-05'
        WHEN p_empresa.data_corte <= 10 THEN '05-10'
        WHEN p_empresa.data_corte <= 15 THEN '10-15'
        WHEN p_empresa.data_corte <= 20 THEN '15-20'
        WHEN p_empresa.data_corte <= 25 THEN '20-25'
        ELSE '25-30'
      END
    WHEN p_empresa.periodo_movimentacao IS NOT NULL AND p_empresa.periodo_movimentacao <> '' THEN
      p_empresa.periodo_movimentacao
    ELSE '25-30'
  END
$function$;

UPDATE public.financeiro_movimentacoes f
SET periodo = public._periodo_para_empresa(e)
FROM public.empresas e
WHERE e.id = f.empresa_id
  AND f.periodo <> public._periodo_para_empresa(e)
  AND COALESCE(f.tipo_lancamento, 'normal') IN ('normal','primeira_mensalidade','fechamento_periodo')
  AND e.data_corte IS NOT NULL
  AND COALESCE(e.periodo_movimentacao, '') = ''
  AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes f2
    WHERE f2.empresa_id = f.empresa_id
      AND f2.mes_referencia = f.mes_referencia
      AND f2.periodo = public._periodo_para_empresa(e)
      AND COALESCE(f2.tipo_lancamento,'normal') = COALESCE(f.tipo_lancamento,'normal')
      AND f2.id <> f.id
  );

UPDATE public.movimentacoes m
SET periodo = public._periodo_para_empresa(e)
FROM public.empresas e
WHERE e.id = m.empresa_id
  AND m.periodo <> public._periodo_para_empresa(e)
  AND e.data_corte IS NOT NULL
  AND COALESCE(e.periodo_movimentacao, '') = ''
  AND NOT EXISTS (
    SELECT 1 FROM public.movimentacoes m2
    WHERE m2.empresa_id = m.empresa_id
      AND m2.mes_referencia = m.mes_referencia
      AND m2.periodo = public._periodo_para_empresa(e)
      AND m2.id <> m.id
  );