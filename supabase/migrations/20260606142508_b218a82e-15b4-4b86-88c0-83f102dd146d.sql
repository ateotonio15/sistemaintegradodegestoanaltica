CREATE OR REPLACE FUNCTION public.cancelar_ferias_cadastro(p_ferias_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_uid uuid := auth.uid();
  v_ferias record;
  e record;
  v_revertidas int := 0;
BEGIN
  SELECT role::text INTO v_role FROM public.user_roles WHERE user_id = v_uid LIMIT 1;
  IF v_role NOT IN ('admin','diretora','comum') THEN
    RAISE EXCEPTION 'Sem permissão para cancelar férias';
  END IF;

  SELECT * INTO v_ferias FROM public.ferias_cadastro WHERE id = p_ferias_id;
  IF v_ferias IS NULL THEN RAISE EXCEPTION 'Férias não encontradas'; END IF;
  IF v_ferias.status = 'encerrada' THEN RAISE EXCEPTION 'Férias já encerradas, não é possível cancelar'; END IF;

  -- Comum só pode cancelar as próprias
  IF v_role = 'comum' AND v_ferias.responsavel_original_user_id <> v_uid THEN
    RAISE EXCEPTION 'Você só pode cancelar as próprias férias';
  END IF;

  -- Devolve cada empresa ao responsável original (apenas se ainda está com o temporário)
  FOR e IN SELECT * FROM public.ferias_cadastro_empresas WHERE ferias_id = p_ferias_id AND status <> 'retornada' LOOP
    UPDATE public.empresas
       SET responsavel_user_id = e.responsavel_original_user_id, updated_at = now()
     WHERE id = e.empresa_id
       AND responsavel_user_id = e.responsavel_temporario_user_id;

    UPDATE public.ferias_cadastro_empresas
       SET status = 'retornada', retornada_em = now(), updated_at = now()
     WHERE id = e.id;

    v_revertidas := v_revertidas + 1;
  END LOOP;

  UPDATE public.ferias_cadastro
     SET status = 'encerrada', updated_at = now()
   WHERE id = p_ferias_id;

  RETURN jsonb_build_object('ok', true, 'revertidas', v_revertidas);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_ferias_cadastro(uuid) TO authenticated;