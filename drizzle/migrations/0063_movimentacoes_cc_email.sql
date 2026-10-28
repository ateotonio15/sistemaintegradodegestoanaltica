ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS cc_email text;

COMMENT ON COLUMN public.movimentacoes.cc_email IS 'E-mails em cópia (Cc) do último envio de relatório de vidas. Editável por Cadastro/Admin/Diretora. Não é operacional.';