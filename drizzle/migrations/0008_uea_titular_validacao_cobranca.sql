ALTER TABLE public.uea_titulares
  ADD COLUMN IF NOT EXISTS cobranca_validada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_validada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_validada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.uea_titulares.cobranca_validada IS 'Confirmação humana de que os descontos dos dependentes estão sendo cobrados do titular.';