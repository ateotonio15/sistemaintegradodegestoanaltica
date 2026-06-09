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
  v_is_financeiro boolean;
  v_is_diretora boolean;
  v_is_resp boolean;
  v_new_status text;
  v_old_status text;
BEGIN
  v_is_admin := public.has_role(v_uid, 'admin'::app_role);
  IF v_is_admin THEN RETURN NEW; END IF;

  v_is_comum := public.has_role(v_uid, 'comum'::app_role) OR public.has_role(v_uid, 'administradoras'::app_role);
  v_is_financeiro := public.has_role(v_uid, 'financeiro'::app_role);
  v_is_diretora := public.has_role(v_uid, 'diretora'::app_role);
  v_is_resp := EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid)
            OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid);

  IF TG_OP = 'UPDATE' THEN
    v_new_status := NEW.status_reajuste;
    v_old_status := OLD.status_reajuste;

    IF v_new_status IS DISTINCT FROM v_old_status
       OR NEW.data_liberacao IS DISTINCT FROM OLD.data_liberacao
       OR NEW.liberado_por IS DISTINCT FROM OLD.liberado_por
       OR NEW.liberado_por_nome IS DISTINCT FROM OLD.liberado_por_nome
       OR NEW.competencia IS DISTINCT FROM OLD.competencia
       OR NEW.confirmado_por IS DISTINCT FROM OLD.confirmado_por
       OR NEW.confirmado_por_nome IS DISTINCT FROM OLD.confirmado_por_nome
       OR NEW.data_confirmacao IS DISTINCT FROM OLD.data_confirmacao
       OR NEW.aprovado_por_user_id IS DISTINCT FROM OLD.aprovado_por_user_id
       OR NEW.aprovado_em IS DISTINCT FROM OLD.aprovado_em
       OR NEW.rejeitado_por_user_id IS DISTINCT FROM OLD.rejeitado_por_user_id
       OR NEW.rejeitado_em IS DISTINCT FROM OLD.rejeitado_em
       OR NEW.retroativo_aplicado_por_user_id IS DISTINCT FROM OLD.retroativo_aplicado_por_user_id
       OR NEW.retroativo_aplicado_em IS DISTINCT FROM OLD.retroativo_aplicado_em
    THEN
      IF v_is_financeiro AND v_new_status = 'retroativo_aplicado' THEN
        RETURN NEW;
      END IF;

      -- Diretora: aprovar, rejeitar, liberar p/ financeiro e devolver ao Cadastro
      IF v_is_diretora AND v_new_status IN ('solicitado','aprovado','rejeitado','pendente_confirmacao','aguardando_aprovacao','liberado_financeiro','liberado') THEN
        RETURN NEW;
      END IF;

      IF v_is_comum AND v_is_resp THEN
        RETURN NEW;
      END IF;

      RAISE EXCEPTION 'Apenas o perfil responsavel pela etapa pode confirmar (Diretora: aprovação · Cadastro: aplicação no contrato · Financeiro: retroativo)';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;