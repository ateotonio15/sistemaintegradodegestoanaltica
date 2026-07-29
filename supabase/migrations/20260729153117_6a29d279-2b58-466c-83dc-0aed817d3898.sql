CREATE OR REPLACE FUNCTION public.gerar_primeira_cobranca_financeira(p_empresa_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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

  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ativar_contratos_pendentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_count int := 0;
  v_emp record;
  v_comp text;
  v_now_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  FOR v_emp IN
    SELECT id, nome, primeira_competencia_financeira, data_implantacao
      FROM public.empresas
     WHERE status_implantacao = 'aguardando_primeiro_fechamento'
  LOOP
    v_comp := COALESCE(v_emp.primeira_competencia_financeira,
                       public.calcular_primeira_competencia(v_emp.id));
    IF v_comp IS NULL OR v_comp > v_now_comp THEN
      CONTINUE;
    END IF;

    UPDATE public.empresas
       SET status_implantacao = 'ativo',
           primeira_competencia_financeira = COALESCE(primeira_competencia_financeira, v_comp),
           primeiro_fechamento_em = COALESCE(primeiro_fechamento_em, now()),
           updated_at = now()
     WHERE id = v_emp.id;

    INSERT INTO public.empresa_implantacao_historico
      (empresa_id, data_implantacao, primeira_competencia, primeiro_fechamento_em, evento, detalhes)
    VALUES
      (v_emp.id, v_emp.data_implantacao, v_comp, now(),
       'ativado_automaticamente', jsonb_build_object('competencia', v_now_comp));

    PERFORM public.gerar_primeira_cobranca_financeira(v_emp.id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;