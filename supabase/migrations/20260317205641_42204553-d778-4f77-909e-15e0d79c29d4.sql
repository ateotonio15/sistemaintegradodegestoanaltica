
CREATE POLICY "Executivo update linked empresas"
ON public.empresas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'executivo'::app_role)
  AND executiva_user_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'executivo'::app_role)
  AND executiva_user_id = auth.uid()
);
