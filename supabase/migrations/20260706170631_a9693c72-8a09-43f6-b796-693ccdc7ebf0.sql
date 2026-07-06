
CREATE POLICY "Executivos read uber_corridas" ON public.uber_corridas
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'executivo_externo'::app_role));

CREATE POLICY "Executivos insert uber_corridas" ON public.uber_corridas
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'executivo_externo'::app_role));

CREATE POLICY "Executivos update uber_corridas" ON public.uber_corridas
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'executivo_externo'::app_role))
WITH CHECK (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'executivo_externo'::app_role));

CREATE POLICY "Executivos delete uber_corridas" ON public.uber_corridas
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'executivo_externo'::app_role));
