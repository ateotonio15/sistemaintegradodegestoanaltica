ALTER TABLE public.uea_dependente_historico
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'faixa',
  ADD COLUMN IF NOT EXISTS valor_mensal_momento NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS margem_titular_momento NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS margem_restante_momento NUMERIC(12,2);