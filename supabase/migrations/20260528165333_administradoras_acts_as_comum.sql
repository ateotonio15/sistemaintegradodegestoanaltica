-- Espelha capabilities de 'comum' para 'administradoras'

-- empresas
CREATE POLICY "Administradoras insert empresas" ON public.empresas
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));
CREATE POLICY "Administradoras update empresas" ON public.empresas
  FOR UPDATE USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

-- implantacoes_contratos
CREATE POLICY "Administradoras manage implantacoes" ON public.implantacoes_contratos
  FOR ALL USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

-- implantacao_anexos (manage)
CREATE POLICY "Administradoras manage impl anexos" ON public.implantacao_anexos
  FOR ALL USING (has_role(auth.uid(), 'administradoras'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

-- implantacao_logs (insert)
CREATE POLICY "Administradoras insert impl logs" ON public.implantacao_logs
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role));

-- implantacao_alertas (manage scoped)
CREATE POLICY "Administradoras manage impl alertas" ON public.implantacao_alertas
  FOR ALL USING (has_role(auth.uid(), 'administradoras'::app_role) AND (destinatario_role = 'administradoras' OR destinatario_role = 'comum') AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND (destinatario_role = 'administradoras' OR destinatario_role = 'comum') AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()));

-- alertas_reajuste (update own)
CREATE POLICY "Administradoras update own alertas_reajuste" ON public.alertas_reajuste
  FOR UPDATE USING (has_role(auth.uid(), 'administradoras'::app_role) AND destinatario_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'administradoras'::app_role) AND destinatario_user_id = auth.uid());

-- reajustes_anuais (manage own responsável)
CREATE POLICY "Administradoras manage reajustes_anuais" ON public.reajustes_anuais
  FOR ALL USING (
    has_role(auth.uid(), 'administradoras'::app_role) AND (
      EXISTS (SELECT 1 FROM empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'administradoras'::app_role) AND (
      EXISTS (SELECT 1 FROM empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
    )
  );

-- reajuste_faixas (manage)
CREATE POLICY "Administradoras manage reajuste_faixas" ON public.reajuste_faixas
  FOR ALL USING (
    has_role(auth.uid(), 'administradoras'::app_role) AND EXISTS (
      SELECT 1 FROM reajustes_anuais ra WHERE ra.id = reajuste_faixas.reajuste_id AND (
        EXISTS (SELECT 1 FROM empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'administradoras'::app_role) AND EXISTS (
      SELECT 1 FROM reajustes_anuais ra WHERE ra.id = reajuste_faixas.reajuste_id AND (
        EXISTS (SELECT 1 FROM empresas e WHERE e.id = ra.empresa_id AND e.responsavel_user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = ra.empresa_id AND eu.user_id = auth.uid())
      )
    )
  );

-- user_roles: já tem "Administradoras view all roles"? Verificar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Administradoras view all roles') THEN
    EXECUTE 'CREATE POLICY "Administradoras view all roles" ON public.user_roles FOR SELECT USING (has_role(auth.uid(), ''administradoras''::app_role))';
  END IF;
END $$;

-- Atualiza guard triggers para também aplicar à administradoras
CREATE OR REPLACE FUNCTION public.guard_movimentacoes_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_autorizado boolean;
BEGIN
  IF public.has_role(v_uid, 'comum'::app_role) OR public.has_role(v_uid, 'administradoras'::app_role) THEN
    IF OLD.data_envio_financeiro IS NOT NULL
       AND NEW.data_envio_financeiro IS DISTINCT FROM OLD.data_envio_financeiro THEN

      v_autorizado :=
           EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid)
        OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid);

      IF NOT v_autorizado THEN
        RAISE EXCEPTION 'Cadastro não pode alterar envio ao financeiro de empresa que não é sua responsabilidade';
      END IF;

      IF NEW.data_envio_financeiro IS NOT NULL AND NEW.data_envio_financeiro > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de envio ao Financeiro não pode ser futura';
      END IF;
    END IF;

    NEW.dentro_prazo := OLD.dentro_prazo;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_reajuste_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean;
  v_is_comum boolean;
  v_is_resp boolean;
BEGIN
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  IF v_is_admin THEN RETURN NEW; END IF;

  v_is_comum := public.has_role(v_uid, 'comum'::app_role) OR public.has_role(v_uid, 'administradoras'::app_role);
  v_is_resp := EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid)
            OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid);

  IF TG_OP = 'UPDATE' THEN
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
$function$;
