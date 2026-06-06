
DROP POLICY IF EXISTS "ferias_admin_diretora_insert" ON public.ferias_cadastro;
CREATE POLICY "ferias_insert" ON public.ferias_cadastro
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role)
           OR public.has_role(auth.uid(),'diretora'::app_role)
           OR public.has_role(auth.uid(),'comum'::app_role));

DROP POLICY IF EXISTS "ferias_admin_diretora_update" ON public.ferias_cadastro;
CREATE POLICY "ferias_update" ON public.ferias_cadastro
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'diretora'::app_role)
      OR public.has_role(auth.uid(),'comum'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role)
           OR public.has_role(auth.uid(),'diretora'::app_role)
           OR public.has_role(auth.uid(),'comum'::app_role));

DROP POLICY IF EXISTS "ferias_emp_admin_diretora_write" ON public.ferias_cadastro_empresas;
CREATE POLICY "ferias_emp_write" ON public.ferias_cadastro_empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role)
      OR public.has_role(auth.uid(),'diretora'::app_role)
      OR public.has_role(auth.uid(),'comum'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role)
           OR public.has_role(auth.uid(),'diretora'::app_role)
           OR public.has_role(auth.uid(),'comum'::app_role));

CREATE OR REPLACE FUNCTION public.criar_ferias_cadastro(
  p_user_id uuid, p_nome text, p_data_inicio date, p_data_fim date, p_atribuicoes jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_ferias_id uuid;
  v_aplicar_agora boolean;
  item jsonb;
  v_emp_id uuid; v_temp_id uuid; v_temp_nome text;
  v_original_atual uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role)
       OR public.has_role(v_uid,'diretora'::app_role)
       OR public.has_role(v_uid,'comum'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para criar férias';
  END IF;
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN RAISE EXCEPTION 'Datas obrigatórias'; END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Data fim < início'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  v_aplicar_agora := (p_data_inicio <= CURRENT_DATE);

  INSERT INTO public.ferias_cadastro (
    responsavel_original_user_id, responsavel_original_nome, data_inicio, data_fim,
    status, criado_por_user_id, criado_por_nome, iniciada_em
  ) VALUES (
    p_user_id, p_nome, p_data_inicio, p_data_fim,
    CASE WHEN v_aplicar_agora THEN 'em_andamento'::ferias_status ELSE 'programada'::ferias_status END,
    v_uid, v_user_nome,
    CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
  ) RETURNING id INTO v_ferias_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_atribuicoes,'[]'::jsonb)) LOOP
    v_emp_id := (item->>'empresa_id')::uuid;
    v_temp_id := (item->>'responsavel_temp_id')::uuid;
    v_temp_nome := item->>'responsavel_temp_nome';

    SELECT responsavel_user_id INTO v_original_atual FROM public.empresas WHERE id = v_emp_id;
    IF v_original_atual IS NULL OR v_original_atual <> p_user_id THEN CONTINUE; END IF;

    INSERT INTO public.ferias_cadastro_empresas (
      ferias_id, empresa_id, responsavel_original_user_id, responsavel_temporario_user_id, responsavel_temporario_nome,
      status, redistribuida_em
    ) VALUES (
      v_ferias_id, v_emp_id, p_user_id, v_temp_id, v_temp_nome,
      CASE WHEN v_aplicar_agora THEN 'redistribuida'::ferias_empresa_status ELSE 'pendente_inicio'::ferias_empresa_status END,
      CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
    );

    IF v_aplicar_agora THEN
      UPDATE public.empresas SET responsavel_user_id = v_temp_id, updated_at = now() WHERE id = v_emp_id;
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.notificacoes (tipo, empresa_id, nome_empresa, codigo_contrato, responsavel_contrato, data_implantacao)
    VALUES ('ferias_iniciada', NULL, p_nome, NULL, p_nome, p_data_inicio::text);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_ferias_id;
END;
$$;
