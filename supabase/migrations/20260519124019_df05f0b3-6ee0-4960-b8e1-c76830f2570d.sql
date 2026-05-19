
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendas';

ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'documentacao_pendente';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'em_analise_diretoria';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'aprovado_diretoria';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'enviado_cadastro';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'implantado';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'rejeitado';
ALTER TYPE public.implantacao_status ADD VALUE IF NOT EXISTS 'necessita_correcao';
