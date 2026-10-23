CREATE TABLE public.nfse_central_credenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 1 AND 80),
  token_hash text NOT NULL UNIQUE,
  criada_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  revogada_em timestamptz,
  revogada_por uuid,
  ultimo_uso_em timestamptz
);
ALTER TABLE public.nfse_central_credenciais ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nfse_central_credenciais FROM anon, authenticated;
GRANT SELECT ON public.nfse_central_credenciais TO authenticated;
GRANT ALL ON public.nfse_central_credenciais TO service_role;
CREATE POLICY "Admin lista credenciais central" ON public.nfse_central_credenciais
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));