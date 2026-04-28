-- Garante unique para upsert por (movimentacao_id, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS alertas_financeiro_mov_tipo_uniq
  ON public.alertas_financeiro (movimentacao_id, tipo);

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
  v_user_nome text;
  v_alerta_id uuid;
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT id, nome, responsavel_user_id
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

  -- Garante movimentação operacional
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