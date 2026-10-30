CREATE TABLE public.uber_funcoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.uber_funcoes TO authenticated;
GRANT ALL ON public.uber_funcoes TO service_role;
ALTER TABLE public.uber_funcoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY uber_funcoes_read ON public.uber_funcoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'enfermeira') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'vendas') OR public.has_role(auth.uid(),'financeiro') OR public.has_role(auth.uid(),'diretora'));
CREATE POLICY uber_funcoes_insert ON public.uber_funcoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'enfermeira') OR public.has_role(auth.uid(),'executivo'));
CREATE POLICY uber_funcoes_update ON public.uber_funcoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'enfermeira') OR public.has_role(auth.uid(),'executivo'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'enfermeira') OR public.has_role(auth.uid(),'executivo'));
INSERT INTO public.uber_funcoes (nome) VALUES ('Executivo(a)'),('Enfermeiro(a)'),('Técnico(a)'),('Estagiário(a)');
ALTER TABLE public.uber_passageiros ADD COLUMN funcao_id uuid NULL;