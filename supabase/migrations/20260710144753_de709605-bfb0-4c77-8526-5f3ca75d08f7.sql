
-- 1) Backfill: restaurar created_at e uploaded_by dos anexos espelhados a partir do Cadastro
UPDATE public.anexos_financeiro af
SET created_at = am.created_at,
    uploaded_by = COALESCE(af.uploaded_by, am.uploaded_by)
FROM public.anexos_movimentacao am
WHERE af.bucket = 'anexos-movimentacoes'
  AND af.storage_path = am.storage_path
  AND af.created_at <> am.created_at;

-- 2) Backfill: mesma correção para financeiro_arquivos (linhas geradas pelo trigger de sync)
UPDATE public.financeiro_arquivos fa
SET created_at = af.created_at,
    updated_at = af.created_at,
    uploaded_by = COALESCE(fa.uploaded_by, af.uploaded_by)
FROM public.anexos_financeiro af
WHERE fa.anexo_financeiro_id = af.id
  AND af.bucket = 'anexos-movimentacoes'
  AND fa.created_at <> af.created_at;

-- 3) Atualiza o gatilho para preservar created_at/uploaded_by da origem
CREATE OR REPLACE FUNCTION public.mirror_anexo_mov_to_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mov record;
  v_fin_mov_id uuid;
  v_tipo_cobranca text;
BEGIN
  SELECT empresa_id, mes_referencia, periodo
    INTO v_mov
  FROM public.movimentacoes
  WHERE id = NEW.movimentacao_id;

  IF v_mov.empresa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_fin_mov_id
  FROM public.financeiro_movimentacoes
  WHERE empresa_id = v_mov.empresa_id
    AND mes_referencia = v_mov.mes_referencia
    AND periodo = v_mov.periodo
  LIMIT 1;

  IF v_fin_mov_id IS NULL THEN
    SELECT tipo_financeiro INTO v_tipo_cobranca FROM public.empresas WHERE id = v_mov.empresa_id;
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo)
    VALUES
      (v_mov.empresa_id, v_mov.mes_referencia, v_mov.periodo, v_tipo_cobranca, true)
    RETURNING id INTO v_fin_mov_id;
  END IF;

  INSERT INTO public.anexos_financeiro
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem, bucket, created_at)
  SELECT v_fin_mov_id, NEW.nome_arquivo, NEW.storage_path, NEW.mime_type, NEW.tamanho_bytes, NEW.uploaded_by, 'normal', 'anexos-movimentacoes', NEW.created_at
  WHERE NOT EXISTS (
    SELECT 1 FROM public.anexos_financeiro af
    WHERE af.financeiro_movimentacao_id = v_fin_mov_id
      AND af.storage_path = NEW.storage_path
  );

  RETURN NEW;
END;
$function$;

-- 4) Atualiza alertar_financeiro_nota para preservar created_at/uploaded_by da origem
CREATE OR REPLACE FUNCTION public.alertar_financeiro_nota(p_empresa_id uuid, p_mes_referencia text, p_periodo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa record;
  v_mov_id uuid;
  v_fin_mov_id uuid;
  v_user_nome text;
  v_alerta_id uuid;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT id, nome, responsavel_user_id, tipo_financeiro INTO v_empresa
  FROM public.empresas WHERE id = p_empresa_id;
  IF v_empresa.id IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;

  v_autorizado :=
       public.has_role(v_uid, 'admin'::app_role)
    OR (
      public.has_role(v_uid, 'comum'::app_role)
      AND (
        v_empresa.responsavel_user_id = v_uid
        OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = v_empresa.id AND eu.user_id = v_uid)
      )
    );
  IF NOT v_autorizado THEN RAISE EXCEPTION 'Sem permissão para alertar o Financeiro desta empresa'; END IF;

  SELECT id INTO v_mov_id FROM public.movimentacoes
  WHERE empresa_id = p_empresa_id AND mes_referencia = p_mes_referencia AND periodo = p_periodo LIMIT 1;
  IF v_mov_id IS NULL THEN
    INSERT INTO public.movimentacoes (empresa_id, mes_referencia, periodo)
    VALUES (p_empresa_id, p_mes_referencia, p_periodo) RETURNING id INTO v_mov_id;
  END IF;

  SELECT id INTO v_fin_mov_id FROM public.financeiro_movimentacoes
  WHERE empresa_id = p_empresa_id AND mes_referencia = p_mes_referencia AND periodo = p_periodo LIMIT 1;
  IF v_fin_mov_id IS NULL THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo, aguardando_nota_em)
    VALUES (p_empresa_id, p_mes_referencia, p_periodo, v_empresa.tipo_financeiro, true, now())
    RETURNING id INTO v_fin_mov_id;
  ELSE
    UPDATE public.financeiro_movimentacoes
       SET aguardando_nota_em = COALESCE(aguardando_nota_em, now())
     WHERE id = v_fin_mov_id AND data_envio_nota IS NULL;
  END IF;

  INSERT INTO public.anexos_financeiro
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem, bucket, created_at)
  SELECT v_fin_mov_id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by, 'normal', 'anexos-movimentacoes', am.created_at
  FROM public.anexos_movimentacao am
  WHERE am.movimentacao_id = v_mov_id
    AND NOT EXISTS (
      SELECT 1 FROM public.anexos_financeiro af
      WHERE af.financeiro_movimentacao_id = v_fin_mov_id AND af.storage_path = am.storage_path
    );

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.alertas_financeiro
    (movimentacao_id, empresa_id, empresa_nome, enviado_por_user_id, enviado_por_nome,
     data_envio, status, tipo, finalizado_em)
  VALUES (v_mov_id, v_empresa.id, v_empresa.nome, v_uid, v_user_nome, CURRENT_DATE, 'Pendente', 'nota', NULL)
  ON CONFLICT (movimentacao_id, tipo) DO UPDATE
    SET status = 'Pendente', finalizado_em = NULL,
        enviado_por_user_id = EXCLUDED.enviado_por_user_id,
        enviado_por_nome = EXCLUDED.enviado_por_nome,
        data_envio = EXCLUDED.data_envio
  RETURNING id INTO v_alerta_id;

  RETURN v_alerta_id;
END;
$function$;
