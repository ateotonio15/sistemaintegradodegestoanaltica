-- Add new columns to empresas table
ALTER TABLE public.empresas
ADD COLUMN IF NOT EXISTS telefone_empresa text,
ADD COLUMN IF NOT EXISTS contato_empresa text;
