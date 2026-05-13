ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS periodo_movimentacao text,
  ADD COLUMN IF NOT EXISTS data_corte integer;