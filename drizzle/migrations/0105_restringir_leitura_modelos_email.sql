DROP POLICY IF EXISTS "Ler modelos" ON public.email_modelos;
CREATE POLICY "Ler modelos" ON public.email_modelos FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));
DROP POLICY IF EXISTS "Ler versões" ON public.email_modelo_versoes;
CREATE POLICY "Ler versões" ON public.email_modelo_versoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));