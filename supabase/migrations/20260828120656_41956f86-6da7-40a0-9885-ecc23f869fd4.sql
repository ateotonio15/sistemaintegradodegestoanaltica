ALTER TABLE public.cobrancas_retroativas
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_origem text,
  ADD COLUMN IF NOT EXISTS valor_planilha_centavos integer,
  ADD COLUMN IF NOT EXISTS conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS conferencia_status text;