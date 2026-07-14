
CREATE TABLE public.atendimentos_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('staff','empresa')),
  autor_id uuid NOT NULL,
  mensagem text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atendimentos_mensagens_atd ON public.atendimentos_mensagens(atendimento_id, criado_em);

GRANT SELECT, INSERT ON public.atendimentos_mensagens TO authenticated;
GRANT ALL ON public.atendimentos_mensagens TO service_role;

ALTER TABLE public.atendimentos_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ler mensagens do atendimento" ON public.atendimentos_mensagens
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.id = atendimento_id
      AND (
        public.user_pode_ver_empresa(a.empresa_id)
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'comum'::app_role)
        OR public.has_role(auth.uid(), 'financeiro'::app_role)
        OR public.has_role(auth.uid(), 'executivo'::app_role)
        OR public.has_role(auth.uid(), 'diretora'::app_role)
        OR public.has_role(auth.uid(), 'visualizacao'::app_role)
      )
  )
);

CREATE POLICY "empresa envia mensagem" ON public.atendimentos_mensagens
FOR INSERT TO authenticated
WITH CHECK (
  autor_tipo = 'empresa'
  AND autor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.atendimentos a
    JOIN public.empresa_usuarios eu ON eu.empresa_id = a.empresa_id
    WHERE a.id = atendimento_id AND eu.user_id = auth.uid()
  )
);

CREATE POLICY "staff envia mensagem" ON public.atendimentos_mensagens
FOR INSERT TO authenticated
WITH CHECK (
  autor_tipo = 'staff'
  AND autor_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'comum'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
  )
);
