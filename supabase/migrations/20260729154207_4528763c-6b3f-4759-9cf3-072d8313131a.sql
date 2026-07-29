CREATE OR REPLACE FUNCTION public.gerar_primeira_cobranca_financeira(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.empresas%ROWTYPE;
  v_periodo text;
  v_mes text;
  v_count int := 0;
BEGIN
  SELECT * INTO v_emp FROM public.empresas WHERE id = p_empresa_id;
  IF v_emp.id IS NULL THEN RETURN 0; END IF;

  v_mes := COALESCE(v_emp.primeira_competencia_financeira,
                    public.calcular_primeira_competencia(p_empresa_id));
  IF v_mes IS NULL THEN RETURN 0; END IF;

  IF v_emp.primeira_competencia_financeira IS NULL THEN
    UPDATE public.empresas SET primeira_competencia_financeira = v_mes WHERE id = p_empresa_id;
  END IF;

  v_periodo := public._periodo_para_empresa(v_emp);

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

  -- Registro operacional (aba Movimentacoes) para o setor de Cadastro
  IF NOT EXISTS (
    SELECT 1 FROM public.movimentacoes
     WHERE empresa_id = p_empresa_id
       AND mes_referencia = v_mes
       AND periodo = v_periodo
  ) THEN
    INSERT INTO public.movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_movimentacao, responsavel_movimentacao)
    VALUES
      (p_empresa_id, v_mes, v_periodo, v_emp.tipo_movimentacao, v_emp.responsavel_user_id);
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$$;