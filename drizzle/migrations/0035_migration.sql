CREATE OR REPLACE FUNCTION public.sync_periodo_movimentacoes_empresa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_novo text;
  v_mes text := to_char(now() AT TIME ZONE 'America/Manaus', 'YYYY-MM');
BEGIN
  v_novo := public._periodo_para_empresa(NEW);
  IF v_novo IS NULL OR v_novo = '' OR v_novo = public._periodo_para_empresa(OLD) THEN
    RETURN NEW;
  END IF;

  UPDATE public.movimentacoes m
     SET periodo = v_novo
   WHERE m.empresa_id = NEW.id
     AND m.mes_referencia >= v_mes
     AND m.data_envio_financeiro IS NULL
     AND m.periodo <> v_novo
     AND NOT EXISTS (
       SELECT 1 FROM public.movimentacoes x
        WHERE x.empresa_id = m.empresa_id AND x.mes_referencia = m.mes_referencia AND x.periodo = v_novo);

  UPDATE public.financeiro_movimentacoes f
     SET periodo = v_novo
   WHERE f.empresa_id = NEW.id
     AND f.mes_referencia >= v_mes
     AND COALESCE(f.tipo_lancamento, 'normal') IN ('normal', 'fechamento_periodo')
     AND f.periodo IS DISTINCT FROM v_novo;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_periodo_movimentacoes ON public.empresas;
CREATE TRIGGER trg_sync_periodo_movimentacoes
AFTER UPDATE OF data_corte, periodo_movimentacao, tipo_movimentacao, tipo_contrato ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.sync_periodo_movimentacoes_empresa();