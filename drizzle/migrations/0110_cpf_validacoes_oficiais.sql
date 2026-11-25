CREATE TABLE public.cpf_validacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id uuid,
  linha integer,
  beneficiario text,
  cpf_mascarado text NOT NULL,
  chave_consulta text NOT NULL,
  status text NOT NULL CHECK (status IN ('validado_oficial','divergencia','nao_localizado','situacao_atencao','indisponivel','sem_data_nasc')),
  situacao text,
  origem text NOT NULL,
  usuario_id uuid NOT NULL,
  consultado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cpf_validacoes_chave_idx ON public.cpf_validacoes (chave_consulta, consultado_em DESC);
GRANT SELECT ON public.cpf_validacoes TO authenticated;
GRANT ALL ON public.cpf_validacoes TO service_role;
ALTER TABLE public.cpf_validacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cpf_validacoes leitura propria ou admin" ON public.cpf_validacoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));