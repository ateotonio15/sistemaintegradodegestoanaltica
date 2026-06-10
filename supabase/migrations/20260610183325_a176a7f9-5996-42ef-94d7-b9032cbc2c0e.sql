
CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  total_registros integer NOT NULL DEFAULT 0,
  importado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  importado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO authenticated;
GRANT ALL ON public.importacoes TO service_role;

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read importacoes"
  ON public.importacoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage importacoes"
  ON public.importacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.demandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_reclamacao date NOT NULL,
  nome_cliente text NOT NULL,
  empresa text,
  setor_responsavel text,
  tipo_reclamacao text,
  reclamacao text,
  detalhamento text,
  observacao text,
  executiva text,
  cpf text,
  data_entrada date,
  nome_medico text,
  nome_procedimento text,
  encaminhado_setor boolean NOT NULL DEFAULT false,
  resolvido_setor boolean NOT NULL DEFAULT false,
  data_resolucao_setor date,
  resolvido_executiva boolean NOT NULL DEFAULT false,
  data_resolucao_executiva date,
  importacao_id uuid REFERENCES public.importacoes(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demandas_data_reclamacao ON public.demandas (data_reclamacao DESC);
CREATE INDEX idx_demandas_empresa ON public.demandas (empresa);
CREATE INDEX idx_demandas_setor ON public.demandas (setor_responsavel);
CREATE INDEX idx_demandas_executiva ON public.demandas (executiva);
CREATE INDEX idx_demandas_importacao_id ON public.demandas (importacao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.demandas TO authenticated;
GRANT ALL ON public.demandas TO service_role;

ALTER TABLE public.demandas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.demanda_can_edit(_executiva text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      NOT public.has_role(auth.uid(), 'diretora'::app_role)
      AND NOT public.has_role(auth.uid(), 'visualizacao'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND _executiva IS NOT NULL
          AND lower(trim(p.display_name)) = lower(trim(_executiva))
      )
    );
$$;

CREATE POLICY "Authenticated can read demandas"
  ON public.demandas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Non-readonly can insert demandas"
  ON public.demandas FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      NOT public.has_role(auth.uid(), 'diretora'::app_role)
      AND NOT public.has_role(auth.uid(), 'visualizacao'::app_role)
    )
  );

CREATE POLICY "Owner or admin can update demandas"
  ON public.demandas FOR UPDATE TO authenticated
  USING (public.demanda_can_edit(executiva))
  WITH CHECK (public.demanda_can_edit(executiva));

CREATE POLICY "Owner or admin can delete demandas"
  ON public.demandas FOR DELETE TO authenticated
  USING (public.demanda_can_edit(executiva));

CREATE TRIGGER trg_demandas_updated_at
  BEFORE UPDATE ON public.demandas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
