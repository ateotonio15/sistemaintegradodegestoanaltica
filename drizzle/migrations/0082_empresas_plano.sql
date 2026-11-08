ALTER TABLE public.empresas ADD COLUMN plano TEXT;
COMMENT ON COLUMN public.empresas.plano IS 'Nome do produto/plano contratado pela empresa (nao e acomodacao).'