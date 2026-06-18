DROP POLICY IF EXISTS "admin diretora write meta diaria" ON public.painel_tv_meta_diaria;
CREATE POLICY "admin diretora financeiro write meta diaria" ON public.painel_tv_meta_diaria
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));