
CREATE TABLE IF NOT EXISTS public.vidas_historico_administradoras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  entradas INTEGER NOT NULL DEFAULT 0,
  saidas INTEGER NOT NULL DEFAULT 0,
  total_atual INTEGER NOT NULL DEFAULT 0,
  total_anterior INTEGER NOT NULL DEFAULT 0,
  calculado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, mes_referencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vidas_historico_administradoras TO authenticated;
GRANT ALL ON public.vidas_historico_administradoras TO service_role;

ALTER TABLE public.vidas_historico_administradoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read vidas_historico_administradoras"
ON public.vidas_historico_administradoras FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admin manage vidas_historico_administradoras"
ON public.vidas_historico_administradoras FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Administradoras manage vidas_historico_administradoras"
ON public.vidas_historico_administradoras FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'administradoras'::app_role))
WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

CREATE INDEX IF NOT EXISTS idx_vidas_historico_adm_mes ON public.vidas_historico_administradoras(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_vidas_historico_adm_empresa ON public.vidas_historico_administradoras(empresa_id);
