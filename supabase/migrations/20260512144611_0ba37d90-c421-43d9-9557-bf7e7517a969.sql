ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS possui_prorrogacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_prorrogacao date,
  ADD COLUMN IF NOT EXISTS motivo_prorrogacao text,
  ADD COLUMN IF NOT EXISTS observacao_prorrogacao text;