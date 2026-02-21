
-- Add new columns to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS tipo_movimentacao text DEFAULT 'Fechada';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS periodo_movimentacao text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS email_empresa text;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS status_empresa text DEFAULT 'Ativa';

-- Add new columns to movimentacoes
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS tipo_movimentacao text;
ALTER TABLE public.movimentacoes ADD COLUMN IF NOT EXISTS dentro_prazo boolean DEFAULT true;
