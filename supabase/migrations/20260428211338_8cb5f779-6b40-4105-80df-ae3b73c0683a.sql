-- 1) Permitir Cadastro autorizado apagar data_envio_financeiro
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

      -- Quando há nova data, valida; quando é NULL (exclusão), permite.
      IF NEW.data_envio_financeiro IS NOT NULL
         AND NEW.data_envio_financeiro > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data de envio ao Financeiro não pode ser futura';
      END IF;
    END IF;

    NEW.dentro_prazo := OLD.dentro_prazo;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Trigger: ao limpar data_envio_financeiro, remover alerta tipo='vencimento'
CREATE OR REPLACE FUNCTION public.remove_alerta_vencimento_on_unset()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.data_envio_financeiro IS NOT NULL
     AND NEW.data_envio_financeiro IS NULL THEN
    DELETE FROM public.alertas_financeiro
     WHERE movimentacao_id = NEW.id
       AND tipo = 'vencimento';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_remove_alerta_vencimento_on_unset ON public.movimentacoes;
CREATE TRIGGER trg_remove_alerta_vencimento_on_unset
AFTER UPDATE OF data_envio_financeiro ON public.movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.remove_alerta_vencimento_on_unset();