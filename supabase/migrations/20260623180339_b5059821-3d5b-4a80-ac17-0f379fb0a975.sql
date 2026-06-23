
-- =========================================
-- 1) avaliacoes_envios — restringe a admin/diretora/executivo
-- =========================================
DROP POLICY IF EXISTS "Autenticados podem ler envios" ON public.avaliacoes_envios;
DROP POLICY IF EXISTS "Autenticados podem criar envios" ON public.avaliacoes_envios;
DROP POLICY IF EXISTS "Autenticados podem atualizar envios" ON public.avaliacoes_envios;

CREATE POLICY "Equipe interna pode ler envios"
ON public.avaliacoes_envios
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
);

CREATE POLICY "Equipe interna pode criar envios"
ON public.avaliacoes_envios
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
);

CREATE POLICY "Equipe interna pode atualizar envios"
ON public.avaliacoes_envios
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
);

-- =========================================
-- 2) demandas — DELETE restrito a admin/diretora (não baseado em display_name)
-- =========================================
DROP POLICY IF EXISTS "Owner or admin can delete demandas" ON public.demandas;

CREATE POLICY "Admin or diretora can delete demandas"
ON public.demandas
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
);

-- =========================================
-- 3) triagens — INSERT verifica vínculo acao/empresa; UPDATE exige acao atual
-- =========================================

-- Função SECURITY DEFINER para validar que a acao_saude pertence à empresa
CREATE OR REPLACE FUNCTION public.acao_saude_pertence_empresa(_acao_id uuid, _empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acoes_saude a
    WHERE a.id = _acao_id AND a.empresa_id = _empresa_id
  );
$$;

DROP POLICY IF EXISTS "triagens_ins" ON public.triagens;
CREATE POLICY "triagens_ins"
ON public.triagens
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR (
    public.has_role(auth.uid(), 'enfermeira'::app_role)
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.user_id = auth.uid() AND eu.empresa_id = triagens.empresa_id
    )
    AND public.acao_saude_pertence_empresa(triagens.acao_id, triagens.empresa_id)
    AND EXISTS (
      SELECT 1 FROM public.acoes_saude a
      WHERE a.id = triagens.acao_id AND a.enfermeira_user_id = auth.uid()
    )
  )
);

-- Restringe UPDATE: enfermeira precisa ser a atual responsável pela acao_saude
CREATE OR REPLACE FUNCTION public.can_update_triagem_row(_uid uuid, _empresa_id uuid, _acao_id uuid)
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
      AND EXISTS (
        SELECT 1 FROM public.acoes_saude a
        WHERE a.id = _acao_id
          AND a.empresa_id = _empresa_id
          AND a.enfermeira_user_id = _uid
      )
    );
$$;

DROP POLICY IF EXISTS "triagens_upd" ON public.triagens;
CREATE POLICY "triagens_upd"
ON public.triagens
FOR UPDATE TO authenticated
USING (public.can_update_triagem_row(auth.uid(), empresa_id, acao_id))
WITH CHECK (public.can_update_triagem_row(auth.uid(), empresa_id, acao_id));
