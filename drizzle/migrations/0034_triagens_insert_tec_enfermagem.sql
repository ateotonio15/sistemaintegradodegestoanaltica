DROP POLICY IF EXISTS triagens_ins ON public.triagens;
CREATE POLICY triagens_ins ON public.triagens FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role)
  OR ((has_role(auth.uid(), 'enfermeira'::app_role) OR has_role(auth.uid(), 'tec_enfermagem'::app_role)) AND created_by = auth.uid())
);