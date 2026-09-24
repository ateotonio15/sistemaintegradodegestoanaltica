-- Garante uma única linha de faturamento por contrato + competência + tipo de lançamento,
-- independente do período (evita duplicidades como 01-05 + 15-20 no mesmo mês).
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_movimentacoes_unica_competencia
  ON public.financeiro_movimentacoes (empresa_id, mes_referencia, tipo_lancamento)
  WHERE tipo_lancamento IN ('normal', 'primeira_mensalidade');