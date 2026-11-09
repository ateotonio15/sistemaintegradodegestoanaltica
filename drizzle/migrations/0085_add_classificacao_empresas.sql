ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS classificacao text;

ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_classificacao_opcoes;

ALTER TABLE public.empresas ADD CONSTRAINT empresas_classificacao_opcoes CHECK (classificacao IS NULL OR classificacao IN ('Empresarial', 'Empresarial Copart. - Total', 'Empresarial Copart. - Parcial'));

COMMENT ON COLUMN public.empresas.classificacao IS 'Classificação comercial do contrato: Empresarial, Empresarial Copart. - Total ou Empresarial Copart. - Parcial.';