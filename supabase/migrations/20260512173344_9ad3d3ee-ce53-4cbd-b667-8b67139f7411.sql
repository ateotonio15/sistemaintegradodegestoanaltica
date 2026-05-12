
-- Flags na tabela reajustes_anuais
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS usa_faixa_etaria_enfermaria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS usa_faixa_etaria_apartamento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS percentual_unico_enfermaria boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS percentual_unico_apartamento boolean NOT NULL DEFAULT true;

-- Tabela de faixas etárias do reajuste
CREATE TABLE IF NOT EXISTS public.reajuste_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reajuste_id uuid NOT NULL REFERENCES public.reajustes_anuais(id) ON DELETE CASCADE,
  modalidade text NOT NULL CHECK (modalidade IN ('enfermaria','apartamento')),
  idade_inicial smallint NOT NULL,
  idade_final smallint NOT NULL,
  valor_atual_centavos bigint NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 0,
  valor_reajustado_centavos bigint NOT NULL DEFAULT 0,
  valor_retroativo_centavos bigint NOT NULL DEFAULT 0,
  valor_final_centavos bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reajuste_id, modalidade, idade_inicial, idade_final)
);

CREATE INDEX IF NOT EXISTS idx_reajuste_faixas_reajuste_id ON public.reajuste_faixas(reajuste_id);

ALTER TABLE public.reajuste_faixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage reajuste_faixas"
  ON public.reajuste_faixas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read reajuste_faixas"
  ON public.reajuste_faixas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Visualizacao manage reajuste_faixas"
  ON public.reajuste_faixas FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'visualizacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Comum responsavel manage reajuste_faixas"
  ON public.reajuste_faixas FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'comum'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.reajustes_anuais ra
      WHERE ra.id = reajuste_faixas.reajuste_id
        AND (
          EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'comum'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.reajustes_anuais ra
      WHERE ra.id = reajuste_faixas.reajuste_id
        AND (
          EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
        )
    )
  );

CREATE TRIGGER trg_reajuste_faixas_updated_at
  BEFORE UPDATE ON public.reajuste_faixas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
