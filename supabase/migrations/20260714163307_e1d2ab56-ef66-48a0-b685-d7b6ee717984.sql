
CREATE POLICY "Enfermeiras read uber_corridas" ON public.uber_corridas FOR SELECT TO authenticated USING (has_role(auth.uid(), 'enfermeira'::app_role));
CREATE POLICY "Enfermeiras insert uber_corridas" ON public.uber_corridas FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'enfermeira'::app_role));
CREATE POLICY "Enfermeiras update uber_corridas" ON public.uber_corridas FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'enfermeira'::app_role)) WITH CHECK (has_role(auth.uid(), 'enfermeira'::app_role));
CREATE POLICY "Enfermeiras delete uber_corridas" ON public.uber_corridas FOR DELETE TO authenticated USING (has_role(auth.uid(), 'enfermeira'::app_role));
