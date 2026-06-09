-- Replicar início de faturamento para todos do grupo
CREATE OR REPLACE FUNCTION public.aplicar_iniciar_faturamento_grupo(p_mov_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  IF v_user_nome IS NULL THEN v_user_nome := 'Usuário'; END IF;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes
       SET faturamento_iniciado_por = v_uid,
           faturamento_iniciado_por_nome = v_user_nome,
           faturamento_iniciado_em = v_now,
           updated_at = v_now
     WHERE id = p_mov_id;
    RETURN 1;
  END IF;

  SELECT array_agg(empresa_id) INTO v_impactados
    FROM public.grupos_financeiros_contratos
   WHERE grupo_id = v_grupo_id AND ativo = true;

  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true
    FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_movimentacoes fm2
        WHERE fm2.empresa_id = gfc.empresa_id
          AND fm2.mes_referencia = v_mov.mes_referencia
          AND fm2.periodo = v_mov.periodo
     );

  UPDATE public.financeiro_movimentacoes fm
     SET faturamento_iniciado_por = v_uid,
         faturamento_iniciado_por_nome = v_user_nome,
         faturamento_iniciado_em = COALESCE(fm.faturamento_iniciado_em, v_now),
         updated_at = v_now
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados)
     AND fm.faturamento_iniciado_em IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'iniciar_faturamento_grupo', 'Faturamento iniciado para o grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $$;

-- Replicar cancelamento de faturamento
CREATE OR REPLACE FUNCTION public.aplicar_cancelar_faturamento_grupo(p_mov_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes
       SET faturamento_iniciado_por = NULL,
           faturamento_iniciado_por_nome = NULL,
           faturamento_iniciado_em = NULL,
           updated_at = now()
     WHERE id = p_mov_id;
    RETURN 1;
  END IF;

  SELECT array_agg(empresa_id) INTO v_impactados
    FROM public.grupos_financeiros_contratos
   WHERE grupo_id = v_grupo_id AND ativo = true;

  UPDATE public.financeiro_movimentacoes fm
     SET faturamento_iniciado_por = NULL,
         faturamento_iniciado_por_nome = NULL,
         faturamento_iniciado_em = NULL,
         updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'cancelar_faturamento_grupo', 'Faturamento cancelado para o grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $$;

-- Replicar dia de emissão para todos do grupo
CREATE OR REPLACE FUNCTION public.aplicar_dia_emissao_grupo(p_mov_id uuid, p_dia_emissao int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET dia_emissao = p_dia_emissao, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;

  SELECT array_agg(empresa_id) INTO v_impactados
    FROM public.grupos_financeiros_contratos
   WHERE grupo_id = v_grupo_id AND ativo = true;

  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true
    FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_movimentacoes fm2
        WHERE fm2.empresa_id = gfc.empresa_id
          AND fm2.mes_referencia = v_mov.mes_referencia
          AND fm2.periodo = v_mov.periodo
     );

  UPDATE public.financeiro_movimentacoes fm
     SET dia_emissao = p_dia_emissao, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'dia_emissao_grupo', 'Dia de emissão aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('dia_emissao', p_dia_emissao, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $$;