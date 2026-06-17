
CREATE TABLE IF NOT EXISTS public.cs_score_empresas (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  incluida_por uuid,
  incluida_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_score_empresas TO authenticated;
GRANT ALL ON public.cs_score_empresas TO service_role;

ALTER TABLE public.cs_score_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cs_score_empresas_select_auth"
  ON public.cs_score_empresas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "cs_score_empresas_insert_priv"
  ON public.cs_score_empresas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'executivo'::app_role)
  );

CREATE POLICY "cs_score_empresas_delete_priv"
  ON public.cs_score_empresas FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'executivo'::app_role)
  );
