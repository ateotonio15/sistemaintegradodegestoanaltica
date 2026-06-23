-- Restaura o significado original das colunas:
-- empresas.responsavel_contrato => quem está cuidando AGORA (substituto durante férias)
-- movimentacoes.responsavel_movimentacao => responsável REAL/original do contrato

CREATE OR REPLACE FUNCTION public.criar_ferias_cadastro(
  p_user_id uuid,
  p_nome text,
  p_data_inicio date,
  p_data_fim date,
  p_atribuicoes jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_ferias_id uuid;
  v_aplicar_agora boolean;
  item jsonb;
  v_emp_id uuid;
  v_temp_id uuid;
  v_temp_nome text;
  v_original_atual uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role)
       OR public.has_role(v_uid,'diretora'::app_role)
       OR public.has_role(v_uid,'comum'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para criar férias';
  END IF;

  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN
    RAISE EXCEPTION 'Datas obrigatórias';
  END IF;
  IF p_data_fim < p_data_inicio THEN
    RAISE EXCEPTION 'Data fim < início';
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  v_aplicar_agora := (p_data_inicio <= CURRENT_DATE);

  INSERT INTO public.ferias_cadastro (
    responsavel_original_user_id, responsavel_original_nome,
    data_inicio, data_fim, status,
    criado_por_user_id, criado_por_nome, iniciada_em
  ) VALUES (
    p_user_id, p_nome, p_data_inicio, p_data_fim,
    CASE WHEN v_aplicar_agora THEN 'em_andamento'::ferias_status ELSE 'programada'::ferias_status END,
    v_uid, v_user_nome,
    CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
  ) RETURNING id INTO v_ferias_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_atribuicoes,'[]'::jsonb)) LOOP
    v_emp_id := (item->>'empresa_id')::uuid;
    v_temp_id := (item->>'responsavel_temp_id')::uuid;
    v_temp_nome := NULLIF(btrim(item->>'responsavel_temp_nome'), '');

    IF v_temp_nome IS NULL THEN
      SELECT COALESCE(display_name, username, 'Usuário') INTO v_temp_nome
      FROM public.profiles WHERE user_id = v_temp_id;
    END IF;

    SELECT responsavel_user_id INTO v_original_atual FROM public.empresas WHERE id = v_emp_id;
    IF v_original_atual IS NULL OR v_original_atual <> p_user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO public.ferias_cadastro_empresas (
      ferias_id, empresa_id, responsavel_original_user_id,
      responsavel_temporario_user_id, responsavel_temporario_nome,
      status, redistribuida_em
    ) VALUES (
      v_ferias_id, v_emp_id, p_user_id, v_temp_id, v_temp_nome,
      CASE WHEN v_aplicar_agora THEN 'redistribuida'::ferias_empresa_status ELSE 'pendente_inicio'::ferias_empresa_status END,
      CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
    );

    IF v_aplicar_agora THEN
      -- Apenas a empresa passa a apontar para o substituto (Resp. Contrato).
      -- movimentacoes.responsavel_movimentacao preserva o responsável REAL.
      UPDATE public.empresas
      SET responsavel_user_id = v_temp_id,
          responsavel_contrato = v_temp_nome,
          updated_at = now()
      WHERE id = v_emp_id;
    END IF;
  END LOOP;

  BEGIN
    INSERT INTO public.notificacoes (tipo, empresa_id, nome_empresa, codigo_contrato, responsavel_contrato, data_implantacao)
    VALUES ('ferias_iniciada', NULL, p_nome, NULL, p_nome, p_data_inicio::text);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_ferias_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_ferias_programadas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f record; e record; v_count int := 0; v_temp_nome text;
BEGIN
  FOR f IN SELECT * FROM public.ferias_cadastro
           WHERE status = 'programada' AND data_inicio <= CURRENT_DATE LOOP
    UPDATE public.ferias_cadastro
    SET status = 'em_andamento', iniciada_em = now(), updated_at = now()
    WHERE id = f.id;

    FOR e IN SELECT * FROM public.ferias_cadastro_empresas
             WHERE ferias_id = f.id AND status = 'pendente_inicio' LOOP
      SELECT COALESCE(NULLIF(btrim(e.responsavel_temporario_nome), ''), p.display_name, p.username, 'Usuário')
      INTO v_temp_nome
      FROM public.profiles p WHERE p.user_id = e.responsavel_temporario_user_id;
      v_temp_nome := COALESCE(v_temp_nome, e.responsavel_temporario_nome, 'Usuário');

      UPDATE public.empresas
      SET responsavel_user_id = e.responsavel_temporario_user_id,
          responsavel_contrato = v_temp_nome,
          updated_at = now()
      WHERE id = e.empresa_id;

      -- Não alterar movimentacoes.responsavel_movimentacao (preserva responsável original)

      UPDATE public.ferias_cadastro_empresas
      SET responsavel_temporario_nome = v_temp_nome,
          status = 'redistribuida',
          redistribuida_em = now(),
          updated_at = now()
      WHERE id = e.id;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reatribuir_ferias_empresa(
  p_fce_id uuid,
  p_new_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fce ferias_cadastro_empresas%ROWTYPE;
  v_ferias_status text;
  v_new_nome text;
  v_can boolean;
BEGIN
  SELECT (has_role(auth.uid(), 'admin'::app_role)
       OR has_role(auth.uid(), 'diretora'::app_role)
       OR has_role(auth.uid(), 'comum'::app_role))
  INTO v_can;
  IF NOT v_can THEN
    RAISE EXCEPTION 'Sem permissão para reatribuir empresa de férias';
  END IF;

  SELECT * INTO v_fce FROM public.ferias_cadastro_empresas WHERE id = p_fce_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  SELECT status::text INTO v_ferias_status FROM public.ferias_cadastro WHERE id = v_fce.ferias_id;
  IF v_ferias_status = 'encerrada' THEN
    RAISE EXCEPTION 'Férias já encerradas';
  END IF;

  SELECT COALESCE(display_name, username, 'Usuário') INTO v_new_nome
  FROM public.profiles WHERE user_id = p_new_user_id;
  IF v_new_nome IS NULL THEN
    RAISE EXCEPTION 'Usuário destino inválido';
  END IF;

  UPDATE public.ferias_cadastro_empresas
  SET responsavel_temporario_user_id = p_new_user_id,
      responsavel_temporario_nome = v_new_nome,
      updated_at = now()
  WHERE id = p_fce_id;

  IF v_fce.status::text IN ('redistribuida', 'aguardando_fechamento') THEN
    UPDATE public.empresas
    SET responsavel_user_id = p_new_user_id,
        responsavel_contrato = v_new_nome,
        updated_at = now()
    WHERE id = v_fce.empresa_id;
    -- Não alterar movimentacoes.responsavel_movimentacao (preserva responsável original)
  END IF;

  RETURN jsonb_build_object('ok', true, 'novo_nome', v_new_nome);
END;
$function$;

CREATE OR REPLACE FUNCTION public.processar_retorno_ferias()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  f record; e record; v_count int := 0; v_pendentes int; v_original_nome text;
BEGIN
  FOR f IN SELECT * FROM public.ferias_cadastro
           WHERE status IN ('em_andamento','aguardando_retorno_contratos')
             AND data_fim < CURRENT_DATE LOOP
    v_original_nome := COALESCE(NULLIF(btrim(f.responsavel_original_nome), ''), 'Usuário');

    FOR e IN SELECT * FROM public.ferias_cadastro_empresas
             WHERE ferias_id = f.id AND status IN ('redistribuida','aguardando_fechamento') LOOP
      IF public.tem_movimentacao_pendente(e.empresa_id) THEN
        UPDATE public.ferias_cadastro_empresas
        SET status = 'aguardando_fechamento',
            motivo_retencao = 'Movimentação/Nota pendente',
            updated_at = now()
        WHERE id = e.id;
      ELSE
        UPDATE public.empresas
        SET responsavel_user_id = e.responsavel_original_user_id,
            responsavel_contrato = v_original_nome,
            updated_at = now()
        WHERE id = e.empresa_id;
        -- movimentacoes.responsavel_movimentacao já estava com o original

        UPDATE public.ferias_cadastro_empresas
        SET status = 'retornada', retornada_em = now(), updated_at = now()
        WHERE id = e.id;
        v_count := v_count + 1;
      END IF;
    END LOOP;

    SELECT count(*) INTO v_pendentes FROM public.ferias_cadastro_empresas
    WHERE ferias_id = f.id AND status <> 'retornada';

    IF v_pendentes = 0 THEN
      UPDATE public.ferias_cadastro
      SET status = 'encerrada', encerrada_em = now(), updated_at = now()
      WHERE id = f.id;
    ELSE
      UPDATE public.ferias_cadastro
      SET status = 'aguardando_retorno_contratos', updated_at = now()
      WHERE id = f.id;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$function$;

-- BACKFILL: restaura movimentacoes.responsavel_movimentacao para o responsável ORIGINAL
-- nos contratos cujas férias estão ativas (foram sobrescritos pelas migrations anteriores).
UPDATE public.movimentacoes m
SET responsavel_movimentacao = fc.responsavel_original_nome,
    updated_at = now()
FROM public.ferias_cadastro_empresas fce
JOIN public.ferias_cadastro fc ON fc.id = fce.ferias_id
WHERE m.empresa_id = fce.empresa_id
  AND m.data_envio_financeiro IS NULL
  AND fc.status IN ('em_andamento','aguardando_retorno_contratos')
  AND fce.status IN ('redistribuida','aguardando_fechamento')
  AND COALESCE(fc.responsavel_original_nome, '') <> '';