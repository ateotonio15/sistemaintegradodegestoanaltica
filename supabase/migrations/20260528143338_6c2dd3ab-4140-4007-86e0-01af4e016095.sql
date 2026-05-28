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
      responsavel_user_id, status_empresa, contrato_faixa_etaria
    ) VALUES (
      COALESCE(v_impl.nome_empresa, 'Empresa sem nome'),
      v_impl.cnpj, v_impl.codigo_contrato, v_impl.grupo_contrato, v_impl.endereco, v_impl.telefone,
      'EMPRESARIAL',
      v_impl.periodo_movimentacao, v_impl.dia_movimentacao, v_impl.data_corte, v_tipo_mov,
      v_impl.inicio_atendimento, COALESCE(v_impl.total_vidas, 0), v_impl.modalidade, v_impl.created_by_nome,
      COALESCE(v_impl.responsavel_cadastro_user_id, v_uid), 'Ativa',
      (v_impl.faixas_etarias IS NOT NULL)
    )
    RETURNING id INTO v_emp_id;
  ELSE
    -- Empresa já existia: sincroniza vidas com o total extraído do layout (Relatório de Vidas)
    IF COALESCE(v_impl.total_vidas, 0) > 0 THEN
      UPDATE public.empresas
         SET vidas = v_impl.total_vidas,
             updated_at = now()
       WHERE id = v_emp_id;
    END IF;
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
    jsonb_build_object('por', v_nome, 'empresa_id', v_emp_id));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'comum' AND status = 'Pendente';

  RETURN v_emp_id;
END $function$;