-- Fix periodo for Fechada type empresas
UPDATE movimentacoes m
SET periodo = e.periodo_movimentacao,
    updated_at = now()
FROM empresas e
WHERE m.empresa_id = e.id
  AND e.tipo_movimentacao = 'Fechada'
  AND e.periodo_movimentacao IS NOT NULL
  AND m.periodo != e.periodo_movimentacao;

-- Fix periodo for Diária type empresas based on data_corte
UPDATE movimentacoes m
SET periodo = CASE
    WHEN e.data_corte <= 5 THEN '01-05'
    WHEN e.data_corte <= 10 THEN '05-10'
    WHEN e.data_corte <= 15 THEN '10-15'
    WHEN e.data_corte <= 20 THEN '15-20'
    WHEN e.data_corte <= 25 THEN '20-25'
    ELSE '25-30'
  END,
  tipo_movimentacao = 'Diária',
  updated_at = now()
FROM empresas e
WHERE m.empresa_id = e.id
  AND e.tipo_movimentacao = 'Diária'
  AND e.data_corte IS NOT NULL
  AND m.periodo != CASE
    WHEN e.data_corte <= 5 THEN '01-05'
    WHEN e.data_corte <= 10 THEN '05-10'
    WHEN e.data_corte <= 15 THEN '10-15'
    WHEN e.data_corte <= 20 THEN '15-20'
    WHEN e.data_corte <= 25 THEN '20-25'
    ELSE '25-30'
  END;