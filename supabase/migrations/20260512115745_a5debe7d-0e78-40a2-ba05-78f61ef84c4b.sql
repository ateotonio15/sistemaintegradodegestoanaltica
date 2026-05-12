
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS possui_enfermaria boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS possui_apartamento boolean NOT NULL DEFAULT true;
