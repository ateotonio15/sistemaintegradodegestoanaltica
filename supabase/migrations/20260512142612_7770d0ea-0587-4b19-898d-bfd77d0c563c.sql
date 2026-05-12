CREATE TABLE public.fora_prazo_exclusoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  periodo text NOT NULL,
  mes_referencia text NOT NULL,
  motivo text,
  removido_por uuid,
  removido_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, periodo, mes_referencia)
);

CREATE INDEX idx_fora_prazo_exclusoes_mes ON public.fora_prazo_exclusoes(mes_referencia);

ALTER TABLE public.fora_prazo_exclusoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fora_prazo_exclusoes"
ON public.fora_prazo_exclusoes FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Admin manage fora_prazo_exclusoes"
ON public.fora_prazo_exclusoes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage fora_prazo_exclusoes"
ON public.fora_prazo_exclusoes FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));