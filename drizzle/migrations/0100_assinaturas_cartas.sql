CREATE TABLE public.assinantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cargo text,
  assinatura_path text,
  rubrica_path text,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_por uuid DEFAULT auth.uid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinantes TO authenticated;
GRANT ALL ON public.assinantes TO service_role;
ALTER TABLE public.assinantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY assinantes_acesso ON public.assinantes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));

CREATE TABLE public.assinaturas_processamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  usuario_nome text,
  assinante_id uuid,
  assinante_nome text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  sucesso integer NOT NULL DEFAULT 0,
  erro integer NOT NULL DEFAULT 0,
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.assinaturas_processamentos TO authenticated;
GRANT ALL ON public.assinaturas_processamentos TO service_role;
ALTER TABLE public.assinaturas_processamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY assin_proc_select ON public.assinaturas_processamentos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));
CREATE POLICY assin_proc_insert ON public.assinaturas_processamentos FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')));

CREATE POLICY assinaturas_cartas_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='assinaturas-cartas' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')));
CREATE POLICY assinaturas_cartas_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='assinaturas-cartas' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')));
CREATE POLICY assinaturas_cartas_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id='assinaturas-cartas' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')));