CREATE TABLE public.assinatura_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  impressao text NOT NULL,
  referencia text,
  pagina text NOT NULL DEFAULT 'ultima',
  desloc_x numeric NOT NULL DEFAULT 0,
  desloc_y numeric NOT NULL DEFAULT 0,
  pos_x numeric NOT NULL,
  pos_y numeric NOT NULL,
  largura numeric NOT NULL DEFAULT 0.3,
  margem_superior numeric NOT NULL DEFAULT 0.04,
  margem_inferior numeric NOT NULL DEFAULT 0.03,
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX assinatura_modelos_impressao_idx ON public.assinatura_modelos(impressao);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinatura_modelos TO authenticated;
GRANT ALL ON public.assinatura_modelos TO service_role;
ALTER TABLE public.assinatura_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinatura_modelos_acesso ON public.assinatura_modelos FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));