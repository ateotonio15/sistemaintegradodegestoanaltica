ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS valor_enfermaria_centavos bigint,
  ADD COLUMN IF NOT EXISTS valor_apartamento_centavos bigint;