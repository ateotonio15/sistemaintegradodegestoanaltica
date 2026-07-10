
-- 1. Restrict get_email_by_username to service_role only
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO service_role;

-- 2. Add admin/financeiro role checks to grupo faturamento RPCs
CREATE OR REPLACE FUNCTION public.aplicar_iniciar_faturamento_grupo(p_mov_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  IF v_user_nome IS NULL THEN v_user_nome := 'Usuário'; END IF;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes
       SET faturamento_iniciado_por = v_uid, faturamento_iniciado_por_nome = v_user_nome, faturamento_iniciado_em = v_now, updated_at = v_now
     WHERE id = p_mov_id;
    RETURN 1;
  END IF;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true
    FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_movimentacoes fm2 WHERE fm2.empresa_id = gfc.empresa_id AND fm2.mes_referencia = v_mov.mes_referencia AND fm2.periodo = v_mov.periodo);
  UPDATE public.financeiro_movimentacoes fm
     SET faturamento_iniciado_por = v_uid, faturamento_iniciado_por_nome = v_user_nome,
         faturamento_iniciado_em = COALESCE(fm.faturamento_iniciado_em, v_now), updated_at = v_now
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados) AND fm.faturamento_iniciado_em IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'iniciar_faturamento_grupo', 'Faturamento iniciado para o grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.aplicar_cancelar_faturamento_grupo(p_mov_id uuid)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET faturamento_iniciado_por = NULL, faturamento_iniciado_por_nome = NULL, faturamento_iniciado_em = NULL, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  UPDATE public.financeiro_movimentacoes fm SET faturamento_iniciado_por = NULL, faturamento_iniciado_por_nome = NULL, faturamento_iniciado_em = NULL, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'cancelar_faturamento_grupo', 'Faturamento cancelado para o grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.aplicar_dda_grupo(p_mov_id uuid, p_boleto_dda boolean, p_pagamento_deposito boolean)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_user_nome text; v_mov record; v_grupo_id uuid; v_count int := 0; v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET boleto_dda = p_boleto_dda, updated_at = now() WHERE id = p_mov_id;
    UPDATE public.empresas SET pagamento_via_deposito = p_pagamento_deposito WHERE id = v_mov.empresa_id;
    RETURN 1;
  END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  UPDATE public.financeiro_movimentacoes fm SET boleto_dda = p_boleto_dda, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.empresas SET pagamento_via_deposito = p_pagamento_deposito WHERE id = ANY(v_impactados);
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'dda_grupo', 'DDA/Depósito aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('boleto_dda', p_boleto_dda, 'pagamento_via_deposito', p_pagamento_deposito));
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.aplicar_dia_emissao_grupo(p_mov_id uuid, p_dia_emissao integer)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_user_nome text; v_mov record; v_grupo_id uuid; v_count int := 0; v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET dia_emissao = p_dia_emissao, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_movimentacoes fm2 WHERE fm2.empresa_id = gfc.empresa_id AND fm2.mes_referencia = v_mov.mes_referencia AND fm2.periodo = v_mov.periodo);
  UPDATE public.financeiro_movimentacoes fm SET dia_emissao = p_dia_emissao, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'dia_emissao_grupo', 'Dia de emissão aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('dia_emissao', p_dia_emissao, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.aplicar_envio_nota_grupo(p_mov_id uuid, p_data_envio date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_user_nome text; v_mov record; v_grupo_id uuid; v_count int := 0; v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET data_envio_nota = p_data_envio, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_movimentacoes fm2 WHERE fm2.empresa_id = gfc.empresa_id AND fm2.mes_referencia = v_mov.mes_referencia AND fm2.periodo = v_mov.periodo);
  UPDATE public.financeiro_movimentacoes fm SET data_envio_nota = p_data_envio, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'envio_nota_grupo', 'Envio de nota aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('data_envio', p_data_envio, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $function$;

CREATE OR REPLACE FUNCTION public.aplicar_vencimento_grupo(p_mov_id uuid, p_data_vencimento date)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); v_user_nome text; v_mov record; v_grupo_id uuid; v_count int := 0; v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para esta ação';
  END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;
  SELECT grupo_id INTO v_grupo_id FROM public.grupos_financeiros_contratos WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;
  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET data_vencimento = p_data_vencimento, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;
  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;
  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_movimentacoes fm2 WHERE fm2.empresa_id = gfc.empresa_id AND fm2.mes_referencia = v_mov.mes_referencia AND fm2.periodo = v_mov.periodo);
  UPDATE public.financeiro_movimentacoes fm SET data_vencimento = p_data_vencimento, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia AND fm.periodo = v_mov.periodo AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.grupos_financeiros_auditoria (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES (v_grupo_id, 'vencimento_grupo', 'Vencimento aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('data_vencimento', p_data_vencimento, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $function$;

-- 3. Fix empresas_externo_read policy: target authenticated instead of public
DROP POLICY IF EXISTS empresas_externo_read ON public.empresas;
CREATE POLICY empresas_externo_read ON public.empresas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'executivo_externo'::app_role) AND (
      (responsavel_user_id = auth.uid())
      OR (executiva_user_id = auth.uid())
      OR (EXISTS (SELECT 1 FROM empresa_usuarios eu WHERE eu.empresa_id = empresas.id AND eu.user_id = auth.uid()))
    )
  );

-- 4. Restrict financeiro_chip_grupos SELECT to internal roles only
DROP POLICY IF EXISTS "auth read chip grupos" ON public.financeiro_chip_grupos;
CREATE POLICY "internal roles read chip grupos" ON public.financeiro_chip_grupos
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'administradoras'::app_role)
  );
