
-- 1) Coluna bucket em anexos_financeiro
ALTER TABLE public.anexos_financeiro
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'anexos-financeiro';

-- 2) Mirror trigger anexos_movimentacao -> anexos_financeiro (grava bucket correto)
CREATE OR REPLACE FUNCTION public.mirror_anexo_mov_to_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem, bucket)
  SELECT v_fin_mov_id, NEW.nome_arquivo, NEW.storage_path, NEW.mime_type, NEW.tamanho_bytes, NEW.uploaded_by, 'normal', 'anexos-movimentacoes'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.anexos_financeiro af
    WHERE af.financeiro_movimentacao_id = v_fin_mov_id
      AND af.storage_path = NEW.storage_path
  );

  RETURN NEW;
END;
$$;

-- 3) alertar_financeiro_nota também: espelha com bucket correto
CREATE OR REPLACE FUNCTION public.alertar_financeiro_nota(
  p_empresa_id uuid,
  p_mes_referencia text,
  p_periodo text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem, bucket)
  SELECT v_fin_mov_id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by, 'normal', 'anexos-movimentacoes'
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
        data_envio = EXCLUDED.data_envio,
        enviado_por_user_id = EXCLUDED.enviado_por_user_id,
        enviado_por_nome = EXCLUDED.enviado_por_nome,
        empresa_nome = EXCLUDED.empresa_nome,
        updated_at = now()
  RETURNING id INTO v_alerta_id;

  RETURN v_alerta_id;
END;
$$;

-- 4) Sync anexos_financeiro -> financeiro_arquivos agora usa o bucket real
CREATE OR REPLACE FUNCTION public.sync_financeiro_arquivos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_comp text;
  v_ext text;
  v_uname text;
BEGIN
  SELECT fm.empresa_id, fm.mes_referencia INTO v_emp, v_comp
  FROM public.financeiro_movimentacoes fm WHERE fm.id = NEW.financeiro_movimentacao_id;

  IF v_emp IS NULL OR v_comp IS NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.financeiro_arquivos
    WHERE storage_path = NEW.storage_path AND bucket = COALESCE(NEW.bucket, 'anexos-financeiro') AND status = 'ativo'
  ) THEN RETURN NEW; END IF;

  v_ext := lower(regexp_replace(coalesce(NEW.nome_arquivo,''), '^.*\.([^.]+)$', '\1'));
  IF v_ext = coalesce(NEW.nome_arquivo,'') THEN v_ext := NULL; END IF;

  SELECT display_name INTO v_uname FROM public.profiles WHERE user_id = NEW.uploaded_by;

  INSERT INTO public.financeiro_arquivos (
    empresa_id, competencia, categoria,
    nome_original, nome_armazenado, extensao, mime_type, tamanho_bytes,
    storage_path, status, versao,
    uploaded_by, uploaded_by_nome,
    bucket, origem, anexo_financeiro_id, financeiro_movimentacao_id
  ) VALUES (
    v_emp, v_comp, public.fin_arq_categoria_auto(NEW.nome_arquivo, NEW.mime_type),
    NEW.nome_arquivo,
    regexp_replace(NEW.storage_path, '^.*/', ''),
    v_ext, NEW.mime_type, NEW.tamanho_bytes,
    NEW.storage_path, 'ativo', 1,
    NEW.uploaded_by, v_uname,
    COALESCE(NEW.bucket, 'anexos-financeiro'), 'financeiro', NEW.id, NEW.financeiro_movimentacao_id
  );

  RETURN NEW;
END;
$$;

-- 5) Backfill: corrige bucket em anexos_financeiro cujo storage_path pertence a anexos_movimentacao
UPDATE public.anexos_financeiro af
   SET bucket = 'anexos-movimentacoes'
  FROM public.anexos_movimentacao am
 WHERE af.storage_path = am.storage_path
   AND af.bucket = 'anexos-financeiro';

-- 6) Backfill: espelha o bucket para financeiro_arquivos
UPDATE public.financeiro_arquivos fa
   SET bucket = af.bucket
  FROM public.anexos_financeiro af
 WHERE fa.anexo_financeiro_id = af.id
   AND fa.bucket IS DISTINCT FROM af.bucket;
