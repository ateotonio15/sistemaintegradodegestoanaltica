ALTER TABLE public.assinaturas_processamentos ADD COLUMN IF NOT EXISTS nome_lote text;
ALTER TABLE public.assinaturas_processamentos ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'concluido';
ALTER TABLE public.assinaturas_processamentos ADD COLUMN IF NOT EXISTS reprocessado_em timestamptz;
ALTER TABLE public.assinantes ADD COLUMN IF NOT EXISTS largura_padrao numeric NOT NULL DEFAULT 0.3;
GRANT UPDATE ON public.assinaturas_processamentos TO authenticated;
CREATE POLICY assin_proc_update ON public.assinaturas_processamentos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));
CREATE INDEX IF NOT EXISTS idx_assin_proc_criado ON public.assinaturas_processamentos (criado_em DESC);