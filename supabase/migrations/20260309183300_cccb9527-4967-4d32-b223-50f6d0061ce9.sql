
UPDATE movimentacoes m
SET periodo = e.periodo_movimentacao,
    updated_at = now()
FROM empresas e
WHERE m.empresa_id = e.id
  AND e.tipo_movimentacao = 'Fechada'
  AND e.periodo_movimentacao IS NOT NULL
  AND m.periodo != e.periodo_movimentacao;
