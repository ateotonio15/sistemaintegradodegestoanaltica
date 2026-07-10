
-- 1) alertar_financeiro_nota agora garante linha financeiro_movimentacoes,
--    marca aguardando_nota_em e espelha anexos_movimentacao -> anexos_financeiro
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, nome, responsavel_user_id, tipo_financeiro
    INTO v_empresa
  FROM public.empresas
  WHERE id = p_empresa_id;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  v_autorizado :=
       public.has_role(v_uid, 'admin'::app_role)
    OR (
      public.has_role(v_uid, 'comum'::app_role)
      AND (
        v_empresa.responsavel_user_id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.empresa_usuarios eu
          WHERE eu.empresa_id = v_empresa.id AND eu.user_id = v_uid
        )
      )
    );

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Sem permissão para alertar o Financeiro desta empresa';
  END IF;

  -- Movimentação operacional
  SELECT id INTO v_mov_id
  FROM public.movimentacoes
  WHERE empresa_id = p_empresa_id
    AND mes_referencia = p_mes_referencia
    AND periodo = p_periodo
  LIMIT 1;

  IF v_mov_id IS NULL THEN
    INSERT INTO public.movimentacoes (empresa_id, mes_referencia, periodo)
    VALUES (p_empresa_id, p_mes_referencia, p_periodo)
    RETURNING id INTO v_mov_id;
  END IF;

  -- Garante linha em financeiro_movimentacoes
  SELECT id INTO v_fin_mov_id
  FROM public.financeiro_movimentacoes
  WHERE empresa_id = p_empresa_id
    AND mes_referencia = p_mes_referencia
    AND periodo = p_periodo
  LIMIT 1;

  IF v_fin_mov_id IS NULL THEN
    INSERT INTO public.financeiro_movimentacoes
      (empresa_id, mes_referencia, periodo, tipo_cobranca, dentro_prazo, aguardando_nota_em)
    VALUES
      (p_empresa_id, p_mes_referencia, p_periodo, v_empresa.tipo_financeiro, true, now())
    RETURNING id INTO v_fin_mov_id;
  ELSE
    UPDATE public.financeiro_movimentacoes
       SET aguardando_nota_em = COALESCE(aguardando_nota_em, now())
     WHERE id = v_fin_mov_id
       AND data_envio_nota IS NULL;
  END IF;

  -- Espelha anexos do Cadastro para o Financeiro (sem duplicar)
  INSERT INTO public.anexos_financeiro
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem)
  SELECT v_fin_mov_id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by, 'normal'
  FROM public.anexos_movimentacao am
  WHERE am.movimentacao_id = v_mov_id
    AND NOT EXISTS (
      SELECT 1 FROM public.anexos_financeiro af
      WHERE af.financeiro_movimentacao_id = v_fin_mov_id
        AND af.storage_path = am.storage_path
    );

  SELECT display_name INTO v_user_nome
  FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.alertas_financeiro
    (movimentacao_id, empresa_id, empresa_nome, enviado_por_user_id, enviado_por_nome,
     data_envio, status, tipo, finalizado_em)
  VALUES
    (v_mov_id, v_empresa.id, v_empresa.nome, v_uid, v_user_nome,
     CURRENT_DATE, 'Pendente', 'nota', NULL)
  ON CONFLICT (movimentacao_id, tipo) DO UPDATE
    SET status = 'Pendente',
        finalizado_em = NULL,
        data_envio = EXCLUDED.data_envio,
        enviado_por_user_id = EXCLUDED.enviado_por_user_id,
        enviado_por_nome = EXCLUDED.enviado_por_nome,
        empresa_nome = EXCLUDED.empresa_nome,
        updated_at = now()
  RETURNING id INTO v_alerta_id;

  RETURN v_alerta_id;
END;
$$;

-- 2) Trigger: qualquer anexo novo no Cadastro é espelhado para o Financeiro
--    (cobre uploads feitos DEPOIS do alerta / edições no Cadastro)
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
    (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem)
  SELECT v_fin_mov_id, NEW.nome_arquivo, NEW.storage_path, NEW.mime_type, NEW.tamanho_bytes, NEW.uploaded_by, 'normal'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.anexos_financeiro af
    WHERE af.financeiro_movimentacao_id = v_fin_mov_id
      AND af.storage_path = NEW.storage_path
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_anexo_mov_to_fin ON public.anexos_movimentacao;
CREATE TRIGGER trg_mirror_anexo_mov_to_fin
AFTER INSERT ON public.anexos_movimentacao
FOR EACH ROW
EXECUTE FUNCTION public.mirror_anexo_mov_to_financeiro();

-- 3) Backfill geral: espelha para o Financeiro TODOS os anexos do Cadastro
--    de movimentações que já foram sinalizadas (aguardando_nota_em) e que
--    ainda não possuem o arquivo correspondente em anexos_financeiro.
INSERT INTO public.anexos_financeiro
  (financeiro_movimentacao_id, nome_arquivo, storage_path, mime_type, tamanho_bytes, uploaded_by, origem)
SELECT f.id, am.nome_arquivo, am.storage_path, am.mime_type, am.tamanho_bytes, am.uploaded_by, 'normal'
FROM public.anexos_movimentacao am
JOIN public.movimentacoes m ON m.id = am.movimentacao_id
JOIN public.financeiro_movimentacoes f
  ON f.empresa_id = m.empresa_id
 AND f.mes_referencia = m.mes_referencia
 AND f.periodo = m.periodo
WHERE f.aguardando_nota_em IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.anexos_financeiro af
    WHERE af.financeiro_movimentacao_id = f.id
      AND af.storage_path = am.storage_path
  );
