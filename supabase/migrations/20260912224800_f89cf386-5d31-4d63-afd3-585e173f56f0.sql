ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS emails_contrato text,
  ADD COLUMN IF NOT EXISTS vidas_enfermaria integer,
  ADD COLUMN IF NOT EXISTS vidas_apartamento integer;

COMMENT ON COLUMN public.implantacoes_contratos.emails_contrato IS 'Destinatários de e-mail do contrato';
COMMENT ON COLUMN public.implantacoes_contratos.vidas_enfermaria IS 'Quantidade de vidas na acomodação enfermaria';
COMMENT ON COLUMN public.implantacoes_contratos.vidas_apartamento IS 'Quantidade de vidas na acomodação apartamento';