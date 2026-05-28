WITH admin_movs AS (
  SELECT
    m.id,
    m.empresa_id,
    m.mes_referencia,
    CASE
      WHEN e.data_corte <= 5 THEN '01-05'
      WHEN e.data_corte <= 10 THEN '05-10'
      WHEN e.data_corte <= 15 THEN '10-15'
      WHEN e.data_corte <= 20 THEN '15-20'
      WHEN e.data_corte <= 25 THEN '20-25'
      ELSE '25-30'
    END AS periodo_correto,
    ROW_NUMBER() OVER (
      PARTITION BY m.empresa_id, m.mes_referencia
      ORDER BY
        (m.data_envio_financeiro IS NOT NULL)::int DESC,
        (m.data_retorno_empresa IS NOT NULL)::int DESC,
        (m.data_envio_empresa IS NOT NULL)::int DESC,
        m.updated_at DESC,
        m.created_at DESC
    ) AS rn
  FROM public.movimentacoes m
  JOIN public.empresas e ON e.id = m.empresa_id
  WHERE e.tipo_contrato = 'ADMINISTRADORA'
    AND e.data_corte IS NOT NULL
)
DELETE FROM public.movimentacoes m
USING admin_movs a
WHERE m.id = a.id
  AND a.rn > 1;

UPDATE public.movimentacoes m
SET periodo = CASE
  WHEN e.data_corte <= 5 THEN '01-05'
  WHEN e.data_corte <= 10 THEN '05-10'
  WHEN e.data_corte <= 15 THEN '10-15'
  WHEN e.data_corte <= 20 THEN '15-20'
  WHEN e.data_corte <= 25 THEN '20-25'
  ELSE '25-30'
END
FROM public.empresas e
WHERE e.id = m.empresa_id
  AND e.tipo_contrato = 'ADMINISTRADORA'
  AND e.data_corte IS NOT NULL
  AND m.periodo IS DISTINCT FROM CASE
    WHEN e.data_corte <= 5 THEN '01-05'
    WHEN e.data_corte <= 10 THEN '05-10'
    WHEN e.data_corte <= 15 THEN '10-15'
    WHEN e.data_corte <= 20 THEN '15-20'
    WHEN e.data_corte <= 25 THEN '20-25'
    ELSE '25-30'
  END;

CREATE OR REPLACE FUNCTION public.normalize_admin_movimentacao_periodo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  empresa_tipo text;
  empresa_corte integer;
BEGIN
  SELECT tipo_contrato, data_corte
  INTO empresa_tipo, empresa_corte
  FROM public.empresas
  WHERE id = NEW.empresa_id;

  IF empresa_tipo = 'ADMINISTRADORA' AND empresa_corte IS NOT NULL THEN
    NEW.periodo := CASE
      WHEN empresa_corte <= 5 THEN '01-05'
      WHEN empresa_corte <= 10 THEN '05-10'
      WHEN empresa_corte <= 15 THEN '10-15'
      WHEN empresa_corte <= 20 THEN '15-20'
      WHEN empresa_corte <= 25 THEN '20-25'
      ELSE '25-30'
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_admin_movimentacao_periodo ON public.movimentacoes;
CREATE TRIGGER trg_normalize_admin_movimentacao_periodo
BEFORE INSERT OR UPDATE OF empresa_id, periodo ON public.movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.normalize_admin_movimentacao_periodo();