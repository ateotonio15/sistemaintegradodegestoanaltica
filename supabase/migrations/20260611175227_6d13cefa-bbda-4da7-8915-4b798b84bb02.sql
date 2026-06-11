
CREATE TABLE public.financeiro_chips_ocultos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  status text,
  ocultado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_chips_ocultos TO authenticated;
GRANT ALL ON public.financeiro_chips_ocultos TO service_role;

ALTER TABLE public.financeiro_chips_ocultos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own hidden chips"
  ON public.financeiro_chips_ocultos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_fco_user_competencia ON public.financeiro_chips_ocultos (user_id, competencia);
