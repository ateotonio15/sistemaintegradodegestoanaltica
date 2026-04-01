
-- Add fatura date columns
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS data_vencimento_fatura date;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS data_emissao_fatura date;

-- Drop and recreate executivo update policy to include executiva_user_id
DROP POLICY IF EXISTS "Executivo update linked empresas" ON public.empresas;
CREATE POLICY "Executivo update linked empresas"
ON public.empresas
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role) AND executiva_user_id = auth.uid())
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role));
