-- 1) Desliga o envio automático ao Financeiro
DROP TRIGGER IF EXISTS trg_envio_financeiro ON public.movimentacoes;

-- 2) RPC manual chamada pelo botão "Enviar ao Financeiro"
CREATE OR REPLACE FUNCTION public.enviar_movimentacao_ao_financeiro(p_mov_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mov record;
  v_empresa record;
  v_user_nome text;
  v_fin_mov_id uuid;
  v_alerta_id uuid;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, empresa_id, mes_referencia, periodo, data_envio_financeiro
    INTO v_mov
  FROM public.movimentacoes
  WHERE id = p_mov_id;

  IF v_mov.id IS NULL THEN
    RAISE EXCEPTION 'Movimentação não encontrada';
  END IF;

  SELECT id, nome, tipo_financeiro, responsavel_user_id
    INTO v_empresa
  FROM public.empresas
  WHERE id = v_mov.empresa_id;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  -- Autorização: admin, financeiro, responsável da empresa, ou vinculado em empresa_usuarios
  v_autorizado :=
       public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'financeiro'::app_role)
    OR v_empresa.responsavel_user_id = v_uid
    OR EXISTS (
         SELECT 1 FROM public.empresa_usuarios eu
         WHERE eu.empresa_id = v_empresa.id AND eu.user_id = v_uid
       );

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Sem permissão para enviar esta empresa ao Financeiro';
  END IF;

  -- Nome do remetente
  SELECT display_name INTO v_user_nome
  FROM public.profiles WHERE user_id = v_uid;

  -- 1) Garante registro em financeiro_movimentacoes
  SELECT id INTO v_fin_mov_id
  FROM public.financeiro_movimentacoes
  WHERE empresa_id = v_mov.empresa_id
    AND mes_referencia = v_mov.mes_referencia
    AND periodo = v_mov.periodo
  LIMIT 1;

  IF v_fin_mov_id IS NULL THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo)
    VALUES
      (v_mov.empresa_id, v_mov.mes_referencia, v_mov.periodo, v_empresa.tipo_financeiro, true)
    RETURNING id INTO v_fin_mov_id;
  END IF;

  -- 2) Espelha anexos da movimentação para anexos_financeiro (sem duplicar)
  INSERT INTO public.anexos_financeiro
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by)
  SELECT v_fin_mov_id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by
  FROM public.anexos_movimentacao am
  WHERE am.movimentacao_id = v_mov.id
    AND NOT EXISTS (
      SELECT 1 FROM public.anexos_financeiro af
      WHERE af.financeiro_movimentacao_id = v_fin_mov_id
        AND af.storage_path = am.storage_path
    );

  -- 3) Upsert do alerta (tipo='vencimento' aproveita o trigger handle_finalizar_alerta_vencimento)
  INSERT INTO public.alertas_financeiro
    (movimentacao_id, empresa_id, empresa_nome, enviado_por_user_id, enviado_por_nome,
     data_envio, status, tipo, finalizado_em)
  VALUES
    (v_mov.id, v_empresa.id, v_empresa.nome, v_uid, v_user_nome,
     CURRENT_DATE, 'Pendente', 'vencimento', NULL)
  ON CONFLICT (movimentacao_id, tipo) DO UPDATE
    SET status = 'Pendente',
        finalizado_em = NULL,
        data_envio = EXCLUDED.data_envio,
        enviado_por_user_id = EXCLUDED.enviado_por_user_id,
        enviado_por_nome = EXCLUDED.enviado_por_nome,
        empresa_nome = EXCLUDED.empresa_nome,
        updated_at = now()
  RETURNING id INTO v_alerta_id;

  -- 4) Marca data_envio_financeiro na movimentação para histórico (já não dispara nada)
  IF v_mov.data_envio_financeiro IS NULL THEN
    UPDATE public.movimentacoes
       SET data_envio_financeiro = CURRENT_DATE,
           updated_at = now()
     WHERE id = v_mov.id;
  END IF;

  RETURN v_alerta_id;
END;
$$;

-- Permissão de execução
REVOKE ALL ON FUNCTION public.enviar_movimentacao_ao_financeiro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enviar_movimentacao_ao_financeiro(uuid) TO authenticated;