
-- Etapa 17: Cadastro responsável pode gerenciar/liberar; Visualização não libera
DROP POLICY IF EXISTS "Comum confirm reajustes_anuais" ON public.reajustes_anuais;

CREATE POLICY "Comum responsavel manage reajustes_anuais"
ON public.reajustes_anuais
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'comum'::app_role) AND (
    EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'comum'::app_role) AND (
    EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
  )
);

-- Substituir a função guard para permitir Cadastro responsável e bloquear liberação por Visualização
CREATE OR REPLACE FUNCTION public.guard_reajuste_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_comum boolean;
  v_is_resp boolean;
BEGIN
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  IF v_is_admin THEN RETURN NEW; END IF;

  v_is_comum := public.has_role(v_uid, 'comum'::app_role);
  v_is_resp := EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid)
            OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid);

  IF TG_OP = 'UPDATE' THEN
    -- Apenas Admin ou Cadastro responsável podem alterar status, liberação ou confirmação
    IF NEW.status_reajuste IS DISTINCT FROM OLD.status_reajuste
       OR NEW.data_liberacao IS DISTINCT FROM OLD.data_liberacao
       OR NEW.liberado_por IS DISTINCT FROM OLD.liberado_por
       OR NEW.liberado_por_nome IS DISTINCT FROM OLD.liberado_por_nome
       OR NEW.competencia IS DISTINCT FROM OLD.competencia
       OR NEW.confirmado_por IS DISTINCT FROM OLD.confirmado_por
       OR NEW.confirmado_por_nome IS DISTINCT FROM OLD.confirmado_por_nome
       OR NEW.data_confirmacao IS DISTINCT FROM OLD.data_confirmacao THEN
      IF NOT (v_is_comum AND v_is_resp) THEN
        RAISE EXCEPTION 'Apenas o Cadastro responsável pela empresa pode liberar reajustes';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir trigger existente
DROP TRIGGER IF EXISTS trg_guard_reajuste_comum ON public.reajustes_anuais;
CREATE TRIGGER trg_guard_reajuste_comum
BEFORE UPDATE ON public.reajustes_anuais
FOR EACH ROW EXECUTE FUNCTION public.guard_reajuste_comum();
