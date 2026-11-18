CREATE OR REPLACE FUNCTION public.processar_contratos_suspensos(p_empresa_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_hoje date := (now() AT TIME ZONE 'America/Manaus')::date;
  v_comp text := to_char(v_hoje, 'YYYY-MM');
  v_uid uuid := auth.uid();
  v_nome text := 'Processo automático';
  e record; r record;
  v_periodo text; v_mov uuid; v_fin uuid;
  n_enc int := 0; n_dev int := 0; n_fora int := 0;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT coalesce(display_name,'Usuário') INTO v_nome FROM public.profiles WHERE user_id = v_uid;
    v_nome := coalesce(v_nome,'Usuário');
  END IF;

  -- 1) Encaminha suspensos da competência atual
  FOR e IN
    SELECT * FROM public.empresas
    WHERE contrato_suspenso = true AND coalesce(status_empresa,'Ativa') <> 'Inativa' AND data_rescisao IS NULL
      AND (p_empresa_id IS NULL OR id = p_empresa_id)
      AND (primeira_competencia_financeira IS NULL OR primeira_competencia_financeira <= v_comp)
  LOOP
    IF EXISTS (SELECT 1 FROM public.movimentacao_suspensos_encaminhamentos x WHERE x.empresa_id = e.id AND x.mes_referencia = v_comp AND x.status = 'encaminhado') THEN
      CONTINUE;
    END IF;
    SELECT id, periodo INTO v_mov, v_periodo FROM public.movimentacoes WHERE empresa_id = e.id AND mes_referencia = v_comp LIMIT 1;
    IF v_periodo IS NULL THEN
      IF (e.tipo_contrato = 'ADMINISTRADORA' OR coalesce(e.tipo_movimentacao,'Fechada') = 'Diária') AND e.data_corte IS NOT NULL THEN
        v_periodo := CASE WHEN e.data_corte <= 5 THEN '01-05' WHEN e.data_corte <= 10 THEN '05-10' WHEN e.data_corte <= 15 THEN '10-15'
                          WHEN e.data_corte <= 20 THEN '15-20' WHEN e.data_corte <= 25 THEN '20-25' ELSE '25-30' END;
      ELSE
        v_periodo := e.periodo_movimentacao;
      END IF;
    END IF;
    IF v_periodo IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_fin FROM public.financeiro_movimentacoes WHERE empresa_id = e.id AND mes_referencia = v_comp AND periodo = v_periodo LIMIT 1;
    IF v_fin IS NULL THEN
      INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo)
      VALUES (e.id, v_comp, v_periodo, e.tipo_financeiro, true) RETURNING id INTO v_fin;
    END IF;

    INSERT INTO public.movimentacao_suspensos_encaminhamentos
      (empresa_id, empresa_nome, codigo_contrato, mes_referencia, periodo, movimentacao_id, financeiro_movimentacao_id, status, encaminhado_em, encaminhado_por, encaminhado_por_nome, reativado_em, resolvido_em)
    VALUES (e.id, e.nome, e.codigo_contrato, v_comp, v_periodo, v_mov, v_fin, 'encaminhado', now(), v_uid, v_nome, NULL, NULL)
    ON CONFLICT (empresa_id, mes_referencia) DO UPDATE SET
      status = 'encaminhado', periodo = EXCLUDED.periodo, movimentacao_id = EXCLUDED.movimentacao_id,
      financeiro_movimentacao_id = EXCLUDED.financeiro_movimentacao_id, encaminhado_em = now(),
      encaminhado_por = EXCLUDED.encaminhado_por, encaminhado_por_nome = EXCLUDED.encaminhado_por_nome,
      reativado_em = NULL, resolvido_em = NULL, observacao = NULL;
    n_enc := n_enc + 1;
    v_mov := NULL; v_periodo := NULL; v_fin := NULL;
  END LOOP;

  -- 2) Reativados: dentro do período volta ao fluxo normal; fora do período encerra o registro
  --    sem criar movimentação retroativa nem exigir análise (movimentação ocorre no próximo mês).
  FOR r IN
    SELECT x.*, em.tipo_movimentacao AS emp_tipo, em.responsavel_contrato AS emp_resp
    FROM public.movimentacao_suspensos_encaminhamentos x
    JOIN public.empresas em ON em.id = x.empresa_id
    WHERE x.status = 'encaminhado' AND coalesce(em.contrato_suspenso,false) = false
      AND (p_empresa_id IS NULL OR x.empresa_id = p_empresa_id)
  LOOP
    IF r.mes_referencia = v_comp AND extract(day FROM v_hoje)::int <= coalesce(public._periodo_fim_dia(r.periodo), 0) THEN
      IF NOT EXISTS (SELECT 1 FROM public.movimentacoes WHERE empresa_id = r.empresa_id AND mes_referencia = r.mes_referencia) THEN
        INSERT INTO public.movimentacoes (empresa_id, mes_referencia, periodo, tipo_movimentacao, responsavel_movimentacao)
        VALUES (r.empresa_id, r.mes_referencia, r.periodo, coalesce(r.emp_tipo,'Fechada'), r.emp_resp);
      END IF;
      UPDATE public.movimentacao_suspensos_encaminhamentos SET status = 'devolvido_fluxo_normal', reativado_em = now(), resolvido_em = now(),
        observacao = 'Reativado dentro do período: devolvido ao fluxo normal de movimentação.' WHERE id = r.id;
      n_dev := n_dev + 1;
    ELSE
      UPDATE public.movimentacao_suspensos_encaminhamentos SET status = 'devolvido_fluxo_normal', reativado_em = now(), resolvido_em = now(),
        observacao = 'Reativado após o encerramento do período: sem movimentação retroativa; será movimentado no próximo mês.' WHERE id = r.id;
      n_fora := n_fora + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('encaminhados', n_enc, 'devolvidos', n_dev, 'reativados_fora_periodo', n_fora);
END $$;
REVOKE ALL ON FUNCTION public.processar_contratos_suspensos(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_contratos_suspensos(uuid) TO authenticated, service_role;

COMMENT ON COLUMN public.movimentacao_suspensos_encaminhamentos.status IS 'DEPRECATED value: analise_humana não é mais gravado; reativações fora do período usam devolvido_fluxo_normal.';