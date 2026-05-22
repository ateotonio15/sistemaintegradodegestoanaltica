
-- 1) Novas colunas
ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS responsavel_cadastro_user_id uuid,
  ADD COLUMN IF NOT EXISTS responsavel_cadastro_nome text;

ALTER TABLE public.implantacao_anexos
  ADD COLUMN IF NOT EXISTS empresa_id uuid;

-- 2) aprovar_implantacao com atribuição direcionada
CREATE OR REPLACE FUNCTION public.aprovar_implantacao(
  p_impl uuid,
  p_observacao text DEFAULT NULL,
  p_responsavel uuid DEFAULT NULL,
  p_responsavel_nome text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text; v_alerta uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas a Diretora pode aprovar';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'aprovado_diretoria',
         progresso = GREATEST(progresso, 75),
         aprovado_em = now(), aprovado_por = v_uid, aprovado_por_nome = v_nome,
         observacao_diretoria = COALESCE(p_observacao, observacao_diretoria),
         enviado_cadastro_em = now(),
         responsavel_cadastro_user_id = COALESCE(p_responsavel, responsavel_cadastro_user_id),
         responsavel_cadastro_nome   = COALESCE(p_responsavel_nome, responsavel_cadastro_nome),
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'aprovado_diretoria',
    jsonb_build_object('por', v_nome, 'observacao', p_observacao, 'responsavel_cadastro', p_responsavel_nome));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'diretora' AND status = 'Pendente';

  INSERT INTO public.implantacao_alertas
    (implantacao_id, tipo, destinatario_role, destinatario_user_id, empresa_nome, mensagem, criado_por, criado_por_nome)
  VALUES
    (p_impl, 'aprovado', 'comum', p_responsavel, v_impl.nome_empresa,
     CASE WHEN p_responsavel_nome IS NOT NULL
          THEN 'Contrato aprovado pela Diretoria e atribuído a ' || p_responsavel_nome
          ELSE 'Contrato aprovado pela Diretoria. Pronto para implantação final.' END,
     v_uid, v_nome)
  RETURNING id INTO v_alerta;
  RETURN v_alerta;
END $$;

-- 3) finalizar_implantacao_cadastro com criação automática de empresa
CREATE OR REPLACE FUNCTION public.finalizar_implantacao_cadastro(p_impl uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_impl record;
  v_nome text;
  v_emp_id uuid;
  v_tipo_mov text;
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

  -- Derivar tipo_movimentacao a partir do periodo
  v_tipo_mov := CASE
    WHEN v_impl.periodo_movimentacao IN ('20-25','25-30') THEN 'Fechada'
    WHEN v_impl.periodo_movimentacao IS NOT NULL THEN 'Diária'
    ELSE 'Fechada'
  END;

  v_emp_id := v_impl.empresa_id;

  -- 1) Já vinculado?
  IF v_emp_id IS NULL AND v_impl.cnpj IS NOT NULL THEN
    SELECT id INTO v_emp_id FROM public.empresas WHERE cnpj = v_impl.cnpj LIMIT 1;
  END IF;

  -- 2) Criar empresa se ainda não existir
  IF v_emp_id IS NULL THEN
    INSERT INTO public.empresas (
      nome, cnpj, codigo_contrato, grupo_contrato, endereco, telefone_empresa,
      tipo_contrato, periodo_movimentacao, dia_movimentacao, data_corte, tipo_movimentacao,
      data_implantacao, vidas, operadora_plano, responsavel_contrato,
      responsavel_user_id, status_empresa, contrato_faixa_etaria
    ) VALUES (
      COALESCE(v_impl.nome_empresa, 'Empresa sem nome'),
      v_impl.cnpj, v_impl.codigo_contrato, v_impl.grupo_contrato, v_impl.endereco, v_impl.telefone,
      COALESCE(v_impl.tipo_contrato, 'EMPRESARIAL'),
      v_impl.periodo_movimentacao, v_impl.dia_movimentacao, v_impl.data_corte, v_tipo_mov,
      v_impl.inicio_atendimento, COALESCE(v_impl.total_vidas, 0), v_impl.modalidade, v_impl.created_by_nome,
      COALESCE(v_impl.responsavel_cadastro_user_id, v_uid), 'Ativa',
      (v_impl.faixas_etarias IS NOT NULL)
    )
    RETURNING id INTO v_emp_id;
  END IF;

  -- 3) Vincular anexos da implantação à empresa
  UPDATE public.implantacao_anexos
     SET empresa_id = v_emp_id
   WHERE implantacao_id = p_impl AND empresa_id IS NULL;

  -- 4) Marcar contrato como implantado e gravar empresa_id
  UPDATE public.implantacoes_contratos
     SET status = 'implantado', progresso = 100,
         empresa_id = v_emp_id,
         implantado_em = now(), implantado_por = v_uid, implantado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'implantado',
    jsonb_build_object('por', v_nome, 'empresa_id', v_emp_id));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'comum' AND status = 'Pendente';

  RETURN v_emp_id;
END $$;

-- 4) Ajustar policy do Cadastro para respeitar destinatario_user_id quando preenchido
DROP POLICY IF EXISTS "Cadastro manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Cadastro manage impl alertas"
ON public.implantacao_alertas FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'comum'::app_role)
  AND destinatario_role = 'comum'
  AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid())
)
WITH CHECK (public.has_role(auth.uid(), 'comum'::app_role));
