ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS envio_boleto_com_nota boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.empresas.envio_boleto_com_nota IS 'Indica se o boleto deve ser enviado junto com a nota fiscal.';