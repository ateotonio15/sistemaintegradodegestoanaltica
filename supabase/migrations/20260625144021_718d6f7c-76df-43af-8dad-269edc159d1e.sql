
-- 1) avaliacoes_envios: restringir SELECT a admin/diretora
DROP POLICY IF EXISTS "Equipe interna pode ler envios" ON public.avaliacoes_envios;
CREATE POLICY "Admin/diretora podem ler envios"
  ON public.avaliacoes_envios FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'diretora'::app_role));

-- 2) financeiro_chip_grupos: restringir DML a financeiro/admin
DROP POLICY IF EXISTS "auth insert chip grupos" ON public.financeiro_chip_grupos;
DROP POLICY IF EXISTS "auth update chip grupos" ON public.financeiro_chip_grupos;
DROP POLICY IF EXISTS "auth delete chip grupos" ON public.financeiro_chip_grupos;

CREATE POLICY "Financeiro/admin inserem chip grupos"
  ON public.financeiro_chip_grupos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro/admin atualizam chip grupos"
  ON public.financeiro_chip_grupos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

CREATE POLICY "Financeiro/admin excluem chip grupos"
  ON public.financeiro_chip_grupos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role));

-- 3) triagens: enfermeira só vê triagens da ação a ela atribuída
CREATE OR REPLACE FUNCTION public.can_access_triagem_row(_uid uuid, _empresa_id uuid, _created_by uuid, _acao_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
        WHERE a.id = _acao_id AND a.enfermeira_user_id = _uid
      )
    );
$function$;
