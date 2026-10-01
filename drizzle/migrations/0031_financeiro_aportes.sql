CREATE TABLE public.financeiro_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  arquivo_id uuid NOT NULL REFERENCES public.financeiro_arquivos(id) ON DELETE CASCADE,
  valor_total numeric(14,2) NOT NULL CHECK (valor_total > 0),
  parcelas integer NOT NULL CHECK (parcelas BETWEEN 1 AND 24),
  competencia_inicial text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.financeiro_aporte_parcelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aporte_id uuid NOT NULL REFERENCES public.financeiro_aportes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  numero integer NOT NULL,
  competencia text NOT NULL,
  valor numeric(14,2) NOT NULL,
  UNIQUE (aporte_id, numero)
);
CREATE INDEX ON public.financeiro_aporte_parcelas (competencia, empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_aportes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_aporte_parcelas TO authenticated;
GRANT ALL ON public.financeiro_aportes TO service_role;
GRANT ALL ON public.financeiro_aporte_parcelas TO service_role;
ALTER TABLE public.financeiro_aportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_aporte_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage aportes" ON public.financeiro_aportes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "read aportes" ON public.financeiro_aportes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'diretora') OR public.has_role(auth.uid(),'visualizacao') OR public.has_role(auth.uid(),'administradoras') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'executivo'));
CREATE POLICY "manage aporte parcelas" ON public.financeiro_aporte_parcelas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'financeiro'));
CREATE POLICY "read aporte parcelas" ON public.financeiro_aporte_parcelas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'diretora') OR public.has_role(auth.uid(),'visualizacao') OR public.has_role(auth.uid(),'administradoras') OR public.has_role(auth.uid(),'comum') OR public.has_role(auth.uid(),'executivo'));