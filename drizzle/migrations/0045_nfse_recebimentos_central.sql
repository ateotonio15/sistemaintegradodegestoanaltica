CREATE TABLE public.nfse_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL DEFAULT 'central_nfse',
  entrega_id uuid NOT NULL,
  documento_origem_id text,
  chave_acesso text NOT NULL,
  cnpj_prestador text NOT NULL,
  cnpj_tomador text NOT NULL,
  numero_nfse text,
  emitida_em timestamptz NOT NULL,
  competencia_fiscal text,
  pdf_sha256 text NOT NULL,
  pdf_tamanho_bytes bigint NOT NULL,
  pdf_tipo text,
  gerador_versao text,
  nome_arquivo text,
  storage_path text,
  movimentacao_sugerida_id uuid,
  movimentacao_destino_id uuid,
  status_observado text,
  estado text NOT NULL DEFAULT 'recebido_pendente',
  motivo text,
  anexo_financeiro_id uuid,
  validador_versao text,
  tentativas integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origem, entrega_id)
);
CREATE INDEX nfse_recebimentos_chave_idx ON public.nfse_recebimentos (origem, cnpj_prestador, chave_acesso);
GRANT SELECT ON public.nfse_recebimentos TO authenticated;
GRANT ALL ON public.nfse_recebimentos TO service_role;
ALTER TABLE public.nfse_recebimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e financeiro leem recebimentos NFS-e" ON public.nfse_recebimentos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));