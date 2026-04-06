
-- Change fatura columns from date to integer (day of month 1-31)
ALTER TABLE public.empresas ALTER COLUMN data_vencimento_fatura TYPE integer USING EXTRACT(DAY FROM data_vencimento_fatura)::integer;
ALTER TABLE public.empresas ALTER COLUMN data_emissao_fatura TYPE integer USING EXTRACT(DAY FROM data_emissao_fatura)::integer;
