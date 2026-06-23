
CREATE OR REPLACE FUNCTION public.reatribuir_ferias_empresa(p_fce_id uuid, p_new_user_id uuid)
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
  SELECT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretora'::app_role) OR has_role(auth.uid(), 'comum'::app_role))
    INTO v_can;
  IF NOT v_can THEN
    RAISE EXCEPTION 'Sem permissão para reatribuir empresa de férias';
  END IF;

  SELECT * INTO v_fce FROM ferias_cadastro_empresas WHERE id = p_fce_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registro não encontrado';
  END IF;

  SELECT status::text INTO v_ferias_status FROM ferias_cadastro WHERE id = v_fce.ferias_id;
  IF v_ferias_status = 'encerrada' THEN
    RAISE EXCEPTION 'Férias já encerradas';
  END IF;

  SELECT COALESCE(display_name, username, 'Usuário') INTO v_new_nome
    FROM profiles WHERE user_id = p_new_user_id;
  IF v_new_nome IS NULL THEN
    RAISE EXCEPTION 'Usuário destino inválido';
  END IF;

  UPDATE ferias_cadastro_empresas
     SET responsavel_temporario_user_id = p_new_user_id,
         responsavel_temporario_nome = v_new_nome,
         updated_at = now()
   WHERE id = p_fce_id;

  IF v_fce.status::text IN ('redistribuida', 'aguardando_fechamento') THEN
    UPDATE empresas
       SET responsavel_user_id = p_new_user_id
     WHERE id = v_fce.empresa_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'novo_nome', v_new_nome);
END;
$function$;
