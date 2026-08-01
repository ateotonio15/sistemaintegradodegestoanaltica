CREATE OR REPLACE FUNCTION public.processar_retorno_ferias()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f record; e record; v_count int := 0; v_pendentes int; v_original_nome text; v_forcar boolean;
BEGIN
  FOR f IN SELECT * FROM public.ferias_cadastro
           WHERE status IN ('em_andamento','aguardando_retorno_contratos')
             AND data_fim < CURRENT_DATE LOOP
    v_original_nome := COALESCE(NULLIF(btrim(f.responsavel_original_nome), ''), 'Usuário');
    -- Após o fim das férias, devolve tudo (pendência não segura mais o contrato)
    v_forcar := (CURRENT_DATE - f.data_fim) >= 1;

    FOR e IN SELECT * FROM public.ferias_cadastro_empresas
             WHERE ferias_id = f.id AND status IN ('redistribuida','aguardando_fechamento') LOOP
      IF NOT v_forcar AND public.tem_movimentacao_pendente(e.empresa_id) THEN
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
$$;