
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS nao_faturado_financeiro boolean NOT NULL DEFAULT false;

UPDATE public.empresas SET nao_faturado_financeiro = true WHERE id = 'ee976d1b-ae61-4bba-8c13-ed829ba76a0a';

DELETE FROM public.financeiro_movimentacoes WHERE empresa_id = 'ee976d1b-ae61-4bba-8c13-ed829ba76a0a';
