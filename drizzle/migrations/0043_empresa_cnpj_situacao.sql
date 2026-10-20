CREATE TABLE public.empresa_cnpj_situacao (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  situacao text NOT NULL DEFAULT '',
  situacao_desde text NOT NULL DEFAULT '',
  endereco jsonb,
  erro text,
  consultado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empresa_cnpj_situacao TO authenticated;
GRANT ALL ON public.empresa_cnpj_situacao TO service_role;

ALTER TABLE public.empresa_cnpj_situacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura autenticada" ON public.empresa_cnpj_situacao
  FOR SELECT TO authenticated USING (true);