ALTER TABLE public.financeiro_arquivos
  ADD COLUMN IF NOT EXISTS cobranca_confirmada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_confirmada_por uuid;