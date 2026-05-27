ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS faturamento_iniciado_por uuid,
  ADD COLUMN IF NOT EXISTS faturamento_iniciado_por_nome text,
  ADD COLUMN IF NOT EXISTS faturamento_iniciado_em timestamptz;