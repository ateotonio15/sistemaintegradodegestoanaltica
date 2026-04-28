-- 1) Permitir Cadastro responsável trocar data_envio_financeiro
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
  IF public.has_role(v_uid, 'comum'::app_role) THEN
    -- Se Cadastro tentou alterar data_envio_financeiro já registrada,
    -- só permite quando é responsável da empresa ou está vinculado em empresa_usuarios.
    IF OLD.data_envio_financeiro IS NOT NULL
       AND NEW.data_envio_financeiro IS DISTINCT FROM OLD.data_envio_financeiro THEN

      v_autorizado :=
           EXISTS (
             SELECT 1 FROM public.empresas e
             WHERE e.id = NEW.empresa_id AND e.responsavel_user_id = v_uid
           )
        OR EXISTS (
             SELECT 1 FROM public.empresa_usuarios eu
             WHERE eu.empresa_id = NEW.empresa_id AND eu.user_id = v_uid
           );

      IF NOT v_autorizado THEN
        RAISE EXCEPTION 'Cadastro não pode alterar envio ao financeiro de empresa que não é sua responsabilidade';
      END IF;

      -- Validação: nova data não pode ser nula nem futura
      IF NEW.data_envio_financeiro IS NULL THEN
        RAISE EXCEPTION 'Data de envio ao Financeiro não pode ser removida';
      END IF;
      IF NEW.data_envio_financeiro > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de envio ao Financeiro não pode ser futura';
      END IF;
    END IF;

    -- Mantém o flag de prazo somente sob controle do financeiro/admin
    NEW.dentro_prazo := OLD.dentro_prazo;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Trigger para sincronizar data_envio do alerta tipo='vencimento' quando data_envio_financeiro muda
CREATE OR REPLACE FUNCTION public.sync_alerta_data_envio()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.data_envio_financeiro IS NOT NULL
     AND NEW.data_envio_financeiro IS DISTINCT FROM OLD.data_envio_financeiro
     AND OLD.data_envio_financeiro IS NOT NULL THEN
    UPDATE public.alertas_financeiro
       SET data_envio = NEW.data_envio_financeiro,
           updated_at = now()
     WHERE movimentacao_id = NEW.id
       AND tipo = 'vencimento';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_alerta_data_envio ON public.movimentacoes;
CREATE TRIGGER trg_sync_alerta_data_envio
AFTER UPDATE OF data_envio_financeiro ON public.movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.sync_alerta_data_envio();