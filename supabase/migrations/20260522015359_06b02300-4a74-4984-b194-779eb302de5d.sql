ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS boleto_dda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleto_confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS boleto_confirmado_em timestamp with time zone;