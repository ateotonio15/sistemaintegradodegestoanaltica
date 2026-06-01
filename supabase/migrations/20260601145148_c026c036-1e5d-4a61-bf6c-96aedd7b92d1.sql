ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS periodo_especifico_cobranca boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS periodo_cobranca_inicio date;