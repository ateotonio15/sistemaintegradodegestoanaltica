CREATE OR REPLACE FUNCTION public.gerar_primeira_cobranca_financeira(p_empresa_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp public.empresas%ROWTYPE;
  v_periodo text;
  v_mes text;
  v_count int := 0;
BEGIN
  SELECT * INTO v_emp FROM public.empresas WHERE id = p_empresa_id;
  IF v_emp.id IS NULL THEN RETURN 0; END IF;
  IF v_emp.primeira_competencia_financeira IS NULL THEN RETURN 0; END IF;

  v_mes := v_emp.primeira_competencia_financeira;
  v_periodo := public._periodo_para_empresa(v_emp);

  -- Primeira Mensalidade só é criada se ainda não houver nenhuma cobrança
  -- para a mesma empresa/competência/período. Isso evita duplicar quando a
  -- linha normal da competência já existe.
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes
     WHERE empresa_id = p_empresa_id
       AND mes_referencia = v_mes
       AND periodo = v_periodo
       AND tipo_lancamento IN ('primeira_mensalidade', 'fechamento_periodo', 'normal')
  ) THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo, tipo_lancamento)
    VALUES
      (p_empresa_id, v_mes, v_periodo, v_emp.tipo_financeiro, true, 'primeira_mensalidade');
    v_count := v_count + 1;
  END IF;

  -- Fechamento do período de movimentação (cobrança regular do período)
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes
     WHERE empresa_id = p_empresa_id
       AND mes_referencia = v_mes
       AND periodo = v_periodo
       AND tipo_lancamento IN ('fechamento_periodo','normal')
  ) THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo, tipo_lancamento)
    VALUES
      (p_empresa_id, v_mes, v_periodo, v_emp.tipo_financeiro, true, 'fechamento_periodo');
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$function$;