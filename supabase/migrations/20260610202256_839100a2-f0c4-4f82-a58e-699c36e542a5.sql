CREATE TABLE public.mailing_brindes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_nome TEXT NOT NULL,
  contato_nome TEXT,
  cargo TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','entregue','devolvido')),
  rastreio_codigo TEXT,
  transportadora TEXT,
  enviado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mailing_brindes TO authenticated;
GRANT ALL ON public.mailing_brindes TO service_role;
ALTER TABLE public.mailing_brindes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth select mailing" ON public.mailing_brindes FOR SELECT TO authenticated USING (true);
CREATE POLICY "editors insert mailing" ON public.mailing_brindes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'comum'));
CREATE POLICY "editors update mailing" ON public.mailing_brindes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'comum'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'comum'));
CREATE POLICY "editors delete mailing" ON public.mailing_brindes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'comum'));

CREATE TRIGGER trg_mailing_brindes_updated BEFORE UPDATE ON public.mailing_brindes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mailing_brindes_status ON public.mailing_brindes(status);
CREATE INDEX idx_mailing_brindes_empresa ON public.mailing_brindes(empresa_nome);