ALTER TABLE public.mailing_brindes
  ADD COLUMN IF NOT EXISTS tipo_cesta TEXT CHECK (tipo_cesta IN ('A','B','C')),
  ADD COLUMN IF NOT EXISTS executiva TEXT;
CREATE INDEX IF NOT EXISTS idx_mailing_brindes_tipo ON public.mailing_brindes(tipo_cesta);
CREATE INDEX IF NOT EXISTS idx_mailing_brindes_executiva ON public.mailing_brindes(executiva);