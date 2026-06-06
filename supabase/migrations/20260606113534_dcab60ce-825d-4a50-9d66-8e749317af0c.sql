
-- 1) Coluna tipo_lancamento em financeiro_movimentacoes
ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS tipo_lancamento text NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN public.financeiro_movimentacoes.tipo_lancamento IS
  'normal | primeira_mensalidade | fechamento_periodo — usado para distinguir os 2 registros gerados na primeira ativação de contratos Recém Implantados.';

-- 2) Helper: deriva o período financeiro a partir da empresa
CREATE OR REPLACE FUNCTION public._periodo_para_empresa(p_empresa public.empresas)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_empresa.tipo_contrato = 'ADMINISTRADORA' AND p_empresa.data_corte IS NOT NULL THEN
      CASE
        WHEN p_empresa.data_corte <= 5 THEN '01-05'
        WHEN p_empresa.data_corte <= 10 THEN '05-10'
        WHEN p_empresa.data_corte <= 15 THEN '10-15'
        WHEN p_empresa.data_corte <= 20 THEN '15-20'
        WHEN p_empresa.data_corte <= 25 THEN '20-25'
        ELSE '25-30'
      END
    WHEN p_empresa.periodo_movimentacao IS NOT NULL AND p_empresa.periodo_movimentacao <> '' THEN
      p_empresa.periodo_movimentacao
    ELSE '25-30'
  END
$$;

-- 3) Helper que gera os 2 registros da primeira cobrança (idempotente)
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
  IF v_emp.primeira_competencia_financeira IS NULL THEN RETURN 0; END IF;

  v_mes := v_emp.primeira_competencia_financeira;
  v_periodo := public._periodo_para_empresa(v_emp);

  -- Primeira Mensalidade (cobrança proporcional/adesão)
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes
     WHERE empresa_id = p_empresa_id
       AND mes_referencia = v_mes
       AND tipo_lancamento = 'primeira_mensalidade'
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
$$;

-- 4) Ativação automática chama o gerador
CREATE OR REPLACE FUNCTION public.ativar_contratos_pendentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_emp record;
  v_now_comp text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  FOR v_emp IN
    SELECT id, nome, primeira_competencia_financeira, data_implantacao
      FROM public.empresas
     WHERE status_implantacao = 'aguardando_primeiro_fechamento'
       AND primeira_competencia_financeira IS NOT NULL
       AND primeira_competencia_financeira <= v_now_comp
  LOOP
    UPDATE public.empresas
       SET status_implantacao = 'ativo',
           primeiro_fechamento_em = COALESCE(primeiro_fechamento_em, now()),
           updated_at = now()
     WHERE id = v_emp.id;

    INSERT INTO public.empresa_implantacao_historico
      (empresa_id, data_implantacao, primeira_competencia, primeiro_fechamento_em, evento, detalhes)
    VALUES
      (v_emp.id, v_emp.data_implantacao, v_emp.primeira_competencia_financeira, now(),
       'ativado_automaticamente', jsonb_build_object('competencia', v_now_comp));

    PERFORM public.gerar_primeira_cobranca_financeira(v_emp.id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 5) Ajusta finalizar_implantacao_cadastro para também gerar 2 registros quando ativa imediatamente
CREATE OR REPLACE FUNCTION public.finalizar_implantacao_cadastro(p_impl uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_impl record;
  v_nome text;
  v_emp_id uuid;
  v_tipo_mov text;
  v_competencia text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode finalizar';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  IF v_impl.status NOT IN ('aprovado_diretoria','enviado_cadastro') THEN
    RAISE EXCEPTION 'Implantação ainda não foi aprovada pela Diretoria';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  v_tipo_mov := CASE
    WHEN v_impl.periodo_movimentacao IN ('20-25','25-30') THEN 'Fechada'
    WHEN v_impl.periodo_movimentacao IS NOT NULL THEN 'Diária'
    ELSE 'Fechada'
  END;

  v_emp_id := v_impl.empresa_id;

  IF v_emp_id IS NULL AND v_impl.cnpj IS NOT NULL THEN
    SELECT id INTO v_emp_id FROM public.empresas WHERE cnpj = v_impl.cnpj LIMIT 1;
  END IF;

  IF v_emp_id IS NULL THEN
    INSERT INTO public.empresas (
      nome, cnpj, codigo_contrato, grupo_contrato, endereco, telefone_empresa,
      tipo_contrato, periodo_movimentacao, dia_movimentacao, data_corte, tipo_movimentacao,
      data_implantacao, vidas, operadora_plano, responsavel_contrato,
      responsavel_user_id, status_empresa, contrato_faixa_etaria,
      status_implantacao
    ) VALUES (
      COALESCE(v_impl.nome_empresa, 'Empresa sem nome'),
      v_impl.cnpj, v_impl.codigo_contrato, v_impl.grupo_contrato, v_impl.endereco, v_impl.telefone,
      'EMPRESARIAL',
      v_impl.periodo_movimentacao, v_impl.dia_movimentacao, v_impl.data_corte, v_tipo_mov,
      v_impl.inicio_atendimento, COALESCE(v_impl.total_vidas, 0), v_impl.modalidade, v_impl.created_by_nome,
      COALESCE(v_impl.responsavel_cadastro_user_id, v_uid), 'Ativa',
      (v_impl.faixas_etarias IS NOT NULL),
      'aguardando_primeiro_fechamento'
    )
    RETURNING id INTO v_emp_id;
  ELSE
    IF COALESCE(v_impl.total_vidas, 0) > 0 THEN
      UPDATE public.empresas
         SET vidas = v_impl.total_vidas,
             updated_at = now()
       WHERE id = v_emp_id;
    END IF;
    UPDATE public.empresas
       SET status_implantacao = 'aguardando_primeiro_fechamento',
           updated_at = now()
     WHERE id = v_emp_id
       AND status_implantacao IS DISTINCT FROM 'ativo';
  END IF;

  v_competencia := public.calcular_primeira_competencia(v_emp_id);
  UPDATE public.empresas
     SET primeira_competencia_financeira = v_competencia,
         updated_at = now()
   WHERE id = v_emp_id;

  INSERT INTO public.empresa_implantacao_historico
    (empresa_id, data_implantacao, primeira_competencia, evento, detalhes)
  SELECT v_emp_id, data_implantacao, v_competencia, 'implantado',
         jsonb_build_object('implantacao_id', p_impl, 'por', v_nome)
    FROM public.empresas WHERE id = v_emp_id;

  IF v_competencia <= to_char(CURRENT_DATE, 'YYYY-MM') THEN
    UPDATE public.empresas
       SET status_implantacao = 'ativo',
           primeiro_fechamento_em = COALESCE(primeiro_fechamento_em, now()),
           updated_at = now()
     WHERE id = v_emp_id;

    PERFORM public.gerar_primeira_cobranca_financeira(v_emp_id);
  END IF;

  UPDATE public.implantacao_anexos
     SET empresa_id = v_emp_id
   WHERE implantacao_id = p_impl AND empresa_id IS NULL;

  UPDATE public.implantacoes_contratos
     SET status = 'implantado', progresso = 100,
         empresa_id = v_emp_id,
         implantado_em = now(), implantado_por = v_uid, implantado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'implantado',
    jsonb_build_object('por', v_nome, 'empresa_id', v_emp_id, 'primeira_competencia', v_competencia));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'comum' AND status = 'Pendente';

  RETURN v_emp_id;
END
$function$;
