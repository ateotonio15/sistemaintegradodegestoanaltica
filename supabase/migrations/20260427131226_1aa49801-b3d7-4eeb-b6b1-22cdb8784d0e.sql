-- 1) Adiciona coluna tipo
ALTER TABLE public.alertas_financeiro
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'nota';

-- 2) Substitui unique antigo (movimentacao_id) por composto (movimentacao_id, tipo)
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.alertas_financeiro'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.alertas_financeiro DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

-- também remove índice único legado se existir
DROP INDEX IF EXISTS public.alertas_financeiro_movimentacao_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS alertas_financeiro_mov_tipo_uniq
  ON public.alertas_financeiro (movimentacao_id, tipo);

-- 3) Trigger para finalizar alerta de vencimento quando o financeiro preencher data_vencimento
CREATE OR REPLACE FUNCTION public.handle_finalizar_alerta_vencimento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.data_vencimento IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.data_vencimento IS NOT NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.alertas_financeiro AS a
     SET status = 'Finalizado',
         finalizado_em = now(),
         updated_at = now()
   WHERE a.status = 'Pendente'
     AND a.tipo = 'vencimento'
     AND a.movimentacao_id IN (
       SELECT m.id FROM public.movimentacoes m
        WHERE m.empresa_id = NEW.empresa_id
          AND m.mes_referencia = NEW.mes_referencia
          AND m.periodo = NEW.periodo
     );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_finalizar_alerta_vencimento ON public.financeiro_movimentacoes;
CREATE TRIGGER trg_finalizar_alerta_vencimento
AFTER INSERT OR UPDATE OF data_vencimento ON public.financeiro_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.handle_finalizar_alerta_vencimento();