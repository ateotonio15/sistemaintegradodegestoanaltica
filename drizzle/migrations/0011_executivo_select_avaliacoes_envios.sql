DROP POLICY IF EXISTS "Admin/diretora podem ler envios" ON public.avaliacoes_envios;
CREATE POLICY "Equipe interna pode ler envios"
ON public.avaliacoes_envios
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'executivo'::app_role));