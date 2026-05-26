
-- Tighten WITH CHECK on implantacao_alertas to prevent role escalation via direct inserts.
-- SECURITY DEFINER RPCs bypass RLS, so cross-role alert routing keeps working.

DROP POLICY IF EXISTS "Cadastro manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Cadastro manage impl alertas" ON public.implantacao_alertas
AS PERMISSIVE FOR ALL
TO public
USING (
  has_role(auth.uid(), 'comum'::app_role)
  AND destinatario_role = 'comum'
  AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'comum'::app_role)
  AND destinatario_role = 'comum'
  AND criado_por = auth.uid()
);

DROP POLICY IF EXISTS "Diretora manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Diretora manage impl alertas" ON public.implantacao_alertas
AS PERMISSIVE FOR ALL
TO public
USING (
  has_role(auth.uid(), 'diretora'::app_role)
  AND destinatario_role = 'diretora'
)
WITH CHECK (
  has_role(auth.uid(), 'diretora'::app_role)
  AND destinatario_role = 'diretora'
  AND criado_por = auth.uid()
);

DROP POLICY IF EXISTS "Vendas manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Vendas manage impl alertas" ON public.implantacao_alertas
AS PERMISSIVE FOR ALL
TO public
USING (
  has_role(auth.uid(), 'vendas'::app_role)
  AND (destinatario_role = 'vendas' OR criado_por = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'vendas'::app_role)
  AND destinatario_role = 'vendas'
  AND criado_por = auth.uid()
);

-- Storage: restrict update/delete on anexos-implantacao to admin or owner of the object.
DROP POLICY IF EXISTS "Implantacao delete anexos" ON storage.objects;
CREATE POLICY "Implantacao delete anexos" ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'anexos-implantacao'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
  )
);

DROP POLICY IF EXISTS "Implantacao update anexos" ON storage.objects;
CREATE POLICY "Implantacao update anexos" ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'anexos-implantacao'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR owner = auth.uid()
  )
);
