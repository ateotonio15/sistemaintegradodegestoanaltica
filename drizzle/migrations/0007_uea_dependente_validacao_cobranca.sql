ALTER TABLE public.uea_dependentes
  ADD COLUMN IF NOT EXISTS cobranca_validada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobranca_validada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cobranca_validada_por uuid REFERENCES auth.users(id);

GRANT UPDATE (cobranca_validada, cobranca_validada_em, cobranca_validada_por) ON public.uea_dependentes TO authenticated;