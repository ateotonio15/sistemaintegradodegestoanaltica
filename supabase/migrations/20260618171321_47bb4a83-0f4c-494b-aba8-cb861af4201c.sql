
-- Mailing brindes: enforce ownership for non-admin/non-diretora writes
DROP POLICY IF EXISTS "editors insert mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors update mailing" ON public.mailing_brindes;
DROP POLICY IF EXISTS "editors delete mailing" ON public.mailing_brindes;

CREATE POLICY "editors insert mailing" ON public.mailing_brindes
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))
    AND created_by = auth.uid()
  )
);

CREATE POLICY "editors update mailing" ON public.mailing_brindes
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))
    AND created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))
    AND created_by = auth.uid()
  )
);

CREATE POLICY "editors delete mailing" ON public.mailing_brindes
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    (has_role(auth.uid(), 'executivo'::app_role) OR has_role(auth.uid(), 'comum'::app_role) OR has_role(auth.uid(), 'administradoras'::app_role))
    AND created_by = auth.uid()
  )
);

-- Triagens: enfermeiras only see/edit their own records or those linked to actions assigned to them
CREATE OR REPLACE FUNCTION public.can_read_triagem(_uid uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    public.has_role(_uid,'admin'::app_role)
    OR public.has_role(_uid,'diretora'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_access_triagem_row(_uid uuid, _empresa_id uuid, _created_by uuid, _acao_id uuid)
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
      AND (
        _created_by = _uid
        OR EXISTS (
          SELECT 1 FROM public.acoes_saude a
          WHERE a.id = _acao_id AND a.enfermeira_user_id = _uid
        )
      )
    );
$$;

DROP POLICY IF EXISTS triagens_select ON public.triagens;
DROP POLICY IF EXISTS triagens_ins ON public.triagens;
DROP POLICY IF EXISTS triagens_upd ON public.triagens;

CREATE POLICY triagens_select ON public.triagens
FOR SELECT TO authenticated
USING (public.can_access_triagem_row(auth.uid(), empresa_id, created_by, acao_id));

CREATE POLICY triagens_ins ON public.triagens
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'diretora'::app_role)
  OR (
    public.has_role(auth.uid(),'enfermeira'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.user_id = auth.uid() AND eu.empresa_id = triagens.empresa_id
    )
  )
);

CREATE POLICY triagens_upd ON public.triagens
FOR UPDATE TO authenticated
USING (public.can_access_triagem_row(auth.uid(), empresa_id, created_by, acao_id))
WITH CHECK (public.can_access_triagem_row(auth.uid(), empresa_id, created_by, acao_id));
