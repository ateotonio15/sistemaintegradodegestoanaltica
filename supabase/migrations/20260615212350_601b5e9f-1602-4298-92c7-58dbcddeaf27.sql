
-- 1) honda_exclusoes: tighten name match to word-boundary
CREATE OR REPLACE FUNCTION public.can_access_honda_exclusoes(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'diretora'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.empresa_usuarios eu
      JOIN public.empresas e ON e.id = eu.empresa_id
      WHERE eu.user_id = _user_id
        AND upper(e.nome) ~ '(^|[^A-Z0-9])HONDA([^A-Z0-9]|$)'
    );
$$;

-- 2) triagens: scope reads/edits by empresa for non-admin/diretora
CREATE OR REPLACE FUNCTION public.can_read_triagem(_uid uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_uid,'admin'::app_role)
    OR public.has_role(_uid,'diretora'::app_role)
    OR (
      public.has_role(_uid,'enfermeira'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.empresa_usuarios eu
        WHERE eu.user_id = _uid AND eu.empresa_id = _empresa_id
      )
    );
$$;

DROP POLICY IF EXISTS triagens_select ON public.triagens;
CREATE POLICY triagens_select ON public.triagens
  FOR SELECT TO authenticated
  USING (public.can_read_triagem(auth.uid(), empresa_id));

DROP POLICY IF EXISTS triagens_upd ON public.triagens;
CREATE POLICY triagens_upd ON public.triagens
  FOR UPDATE TO authenticated
  USING (public.can_read_triagem(auth.uid(), empresa_id))
  WITH CHECK (public.can_read_triagem(auth.uid(), empresa_id));

DROP POLICY IF EXISTS triagens_del ON public.triagens;
CREATE POLICY triagens_del ON public.triagens
  FOR DELETE TO authenticated
  USING (public.can_read_triagem(auth.uid(), empresa_id));

DROP POLICY IF EXISTS triagens_ins ON public.triagens;
CREATE POLICY triagens_ins ON public.triagens
  FOR INSERT TO authenticated
  WITH CHECK (public.can_read_triagem(auth.uid(), empresa_id));

-- 3) mailing_brindes: scope by creator for non-admin/diretora (table has no empresa_id)
DROP POLICY IF EXISTS mailing_brindes_role_select ON public.mailing_brindes;
CREATE POLICY mailing_brindes_role_select ON public.mailing_brindes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (has_role(auth.uid(), 'executivo'::app_role)
       OR has_role(auth.uid(), 'comum'::app_role)
       OR has_role(auth.uid(), 'administradoras'::app_role))
      AND created_by = auth.uid()
    )
  );
