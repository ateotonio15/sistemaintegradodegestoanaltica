
CREATE POLICY "Comum user update empresa status"
ON public.empresas
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'comum'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'comum'::app_role)
);
