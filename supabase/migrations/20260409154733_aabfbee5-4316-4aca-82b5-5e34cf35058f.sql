
-- Add endereco to empresas
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS endereco text;

-- Add endereco_empresa to saude_agendamentos
ALTER TABLE public.saude_agendamentos ADD COLUMN IF NOT EXISTS endereco_empresa text;

-- Allow executivo to manage saude_agendamentos
CREATE POLICY "Executivo manage saude_agendamentos"
ON public.saude_agendamentos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));
