
CREATE TABLE public.atendimentos_redirecionamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atendimento_id uuid NOT NULL REFERENCES public.atendimentos(id) ON DELETE CASCADE,
  setor_de text NOT NULL CHECK (setor_de IN ('cadastro','relacionamento','financeiro')),
  setor_para text NOT NULL CHECK (setor_para IN ('cadastro','relacionamento','financeiro')),
  redirecionado_por uuid NOT NULL REFERENCES auth.users(id),
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.atendimentos_redirecionamentos TO authenticated;
GRANT ALL ON public.atendimentos_redirecionamentos TO service_role;

ALTER TABLE public.atendimentos_redirecionamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_interno gerencia redirecionamentos"
ON public.atendimentos_redirecionamentos
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin_interno'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin_interno'::app_role) AND redirecionado_por = auth.uid());

CREATE INDEX idx_atend_redir_atendimento ON public.atendimentos_redirecionamentos(atendimento_id);

-- Permitir admin_interno atualizar atendimentos (status / setor_destino)
DROP POLICY IF EXISTS "admin_interno atualiza atendimentos" ON public.atendimentos;
CREATE POLICY "admin_interno atualiza atendimentos"
ON public.atendimentos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin_interno'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin_interno'::app_role));
