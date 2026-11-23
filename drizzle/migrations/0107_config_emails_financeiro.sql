CREATE TABLE public.config_emails_financeiro (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  para text[] NOT NULL DEFAULT '{}',
  cc text[] NOT NULL DEFAULT '{}',
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.config_emails_financeiro TO authenticated;
GRANT ALL ON public.config_emails_financeiro TO service_role;
ALTER TABLE public.config_emails_financeiro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ler emails financeiro" ON public.config_emails_financeiro FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'administradoras'));