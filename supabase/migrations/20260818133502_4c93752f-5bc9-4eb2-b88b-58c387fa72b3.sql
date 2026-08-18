CREATE OR REPLACE FUNCTION public.is_saude_editor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'enfermeira'::app_role)
      OR public.has_role(_uid,'tec_enfermagem'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.is_saude_reader(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin'::app_role)
      OR public.has_role(_uid,'enfermeira'::app_role)
      OR public.has_role(_uid,'tec_enfermagem'::app_role)
      OR public.has_role(_uid,'diretora'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_access_triagem_row(_uid uuid, _empresa_id uuid, _created_by uuid, _acao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_uid, 'admin'::public.app_role)
    OR public.has_role(_uid, 'diretora'::public.app_role)
    OR (
      (public.has_role(_uid, 'enfermeira'::public.app_role) OR public.has_role(_uid, 'tec_enfermagem'::public.app_role))
      AND EXISTS (
        SELECT 1 FROM public.acoes_saude a
        WHERE a.id = _acao_id AND a.empresa_id = _empresa_id AND a.enfermeira_user_id = _uid
      )
    )
    OR (
      (public.has_role(_uid, 'enfermeira'::public.app_role) OR public.has_role(_uid, 'tec_enfermagem'::public.app_role))
      AND _created_by = _uid
      AND public.acao_saude_pertence_empresa(_acao_id, _empresa_id)
    );
$$;

CREATE OR REPLACE FUNCTION public.can_update_triagem_row(_uid uuid, _empresa_id uuid, _acao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_role(_uid, 'admin'::public.app_role)
    OR public.has_role(_uid, 'diretora'::public.app_role)
    OR (
      (public.has_role(_uid, 'enfermeira'::public.app_role) OR public.has_role(_uid, 'tec_enfermagem'::public.app_role))
      AND EXISTS (
        SELECT 1 FROM public.acoes_saude a
        WHERE a.id = _acao_id AND a.empresa_id = _empresa_id AND a.enfermeira_user_id = _uid
      )
    );
$$;