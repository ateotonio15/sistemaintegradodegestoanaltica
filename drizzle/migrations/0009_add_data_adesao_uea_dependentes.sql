ALTER TABLE public.uea_dependentes
ADD COLUMN IF NOT EXISTS data_adesao date;

COMMENT ON COLUMN public.uea_dependentes.data_adesao IS 'Data de adesão do dependente informada no Layout de Vidas importado';