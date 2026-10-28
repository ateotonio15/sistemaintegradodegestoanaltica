COMMENT ON COLUMN public.movimentacoes.cc_email IS 'DEPRECATED: não usar. O Cc do relatório de vidas fica em movimentacao_relatorios.cc.';

ALTER TABLE public.movimentacao_relatorios
  ADD COLUMN IF NOT EXISTS cc text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.movimentacao_relatorios.cc IS 'E-mails em cópia (Cc) do envio de relatório de vidas. Editável por Cadastro/Admin/Diretora. Não é operacional.';