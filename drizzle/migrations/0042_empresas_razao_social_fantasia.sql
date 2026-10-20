ALTER TABLE public.empresas ADD COLUMN razao_social TEXT;
ALTER TABLE public.empresas ADD COLUMN nome_fantasia TEXT;
COMMENT ON COLUMN public.empresas.razao_social IS 'Razao social preenchida via consulta publica de CNPJ ou manualmente';
COMMENT ON COLUMN public.empresas.nome_fantasia IS 'Nome fantasia preenchido via consulta publica de CNPJ ou manualmente';