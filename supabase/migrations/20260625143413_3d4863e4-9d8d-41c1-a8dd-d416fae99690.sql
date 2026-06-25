
CREATE TABLE public.financeiro_chip_grupos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia TEXT NOT NULL,
  empresa_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_chip_grupos TO authenticated;
GRANT ALL ON public.financeiro_chip_grupos TO service_role;
ALTER TABLE public.financeiro_chip_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read chip grupos" ON public.financeiro_chip_grupos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert chip grupos" ON public.financeiro_chip_grupos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update chip grupos" ON public.financeiro_chip_grupos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete chip grupos" ON public.financeiro_chip_grupos FOR DELETE TO authenticated USING (true);
CREATE INDEX idx_fin_chip_grupos_competencia ON public.financeiro_chip_grupos(competencia);
CREATE TRIGGER trg_fin_chip_grupos_updated BEFORE UPDATE ON public.financeiro_chip_grupos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
