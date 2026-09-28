ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS sem_executiva_vinculada boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.empresas.sem_executiva_vinculada IS 'Empresa atendida por várias executivas: QR/link de avaliação gerado sem executiva vinculada';

UPDATE public.empresas SET sem_executiva_vinculada = true
 WHERE translate(upper(nome),'ÁÀÂÃÉÊÍÓÔÕÚÇ','AAAAEEIOOOUC') LIKE '%YAMAHA%'
    OR translate(upper(nome),'ÁÀÂÃÉÊÍÓÔÕÚÇ','AAAAEEIOOOUC') LIKE '%HONDA%';

CREATE OR REPLACE FUNCTION public.empresa_sem_executiva_unica(_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT sem_executiva_vinculada FROM public.empresas WHERE id = _empresa_id), false)
$$;

CREATE OR REPLACE FUNCTION public.avaliacoes_envios_sem_executiva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.empresa_id IS NOT NULL AND public.empresa_sem_executiva_unica(NEW.empresa_id) THEN
    NEW.executiva_user_id := NULL;
    NEW.executiva_nome := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_avaliacoes_envios_sem_executiva ON public.avaliacoes_envios;
CREATE TRIGGER trg_avaliacoes_envios_sem_executiva BEFORE INSERT ON public.avaliacoes_envios
FOR EACH ROW EXECUTE FUNCTION public.avaliacoes_envios_sem_executiva();

CREATE OR REPLACE FUNCTION public.get_avaliacao_envio_por_token(p_token text)
 RETURNS TABLE(id uuid, empresa_id uuid, empresa_nome text, executiva_nome text, data_resposta timestamp with time zone, formulario_id uuid, mes_referencia text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.empresa_id, e.empresa_nome,
         CASE WHEN COALESCE(emp.sem_executiva_vinculada,false) THEN NULL
              ELSE COALESCE(p.display_name, e.executiva_nome) END,
         e.data_resposta, e.formulario_id, e.mes_referencia
  FROM public.avaliacoes_envios e
  LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.profiles p ON p.user_id = emp.executiva_user_id
  WHERE e.token_unico = p_token
  LIMIT 1;
$function$;

DROP FUNCTION IF EXISTS public.responder_avaliacao_por_token(text, jsonb, text, numeric);
CREATE FUNCTION public.responder_avaliacao_por_token(p_token text, p_respostas jsonb, p_comentario text, p_nota_media numeric, p_executiva_informada text DEFAULT NULL)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_env record; v_form_id uuid; v_resp_id uuid; v_exec text;
BEGIN
  SELECT e.id, e.empresa_nome, e.formulario_id,
         COALESCE(emp.sem_executiva_vinculada,false) AS sem_exec,
         COALESCE(p.display_name, e.executiva_nome) AS exec_atual
    INTO v_env
  FROM public.avaliacoes_envios e
  LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.profiles p ON p.user_id = emp.executiva_user_id
  WHERE e.token_unico = p_token LIMIT 1;

  IF v_env.id IS NULL THEN RAISE EXCEPTION 'Link inválido'; END IF;

  IF v_env.sem_exec THEN
    v_exec := NULLIF(left(trim(COALESCE(p_executiva_informada,'')), 120), '');
  ELSE
    v_exec := v_env.exec_atual;
  END IF;

  v_form_id := v_env.formulario_id;
  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id FROM public.cs_avaliacao_formularios WHERE tipo = 'rh' ORDER BY created_at DESC LIMIT 1;
  END IF;

  INSERT INTO public.cs_avaliacao_respostas
    (formulario_id, respostas, nota_media, comentario, nome_empresa, nome_executiva, envio_id)
  VALUES
    (v_form_id, COALESCE(p_respostas, '{}'::jsonb), p_nota_media,
     NULLIF(trim(COALESCE(p_comentario,'')), ''), v_env.empresa_nome, v_exec, v_env.id)
  RETURNING id INTO v_resp_id;

  UPDATE public.avaliacoes_envios
     SET data_resposta = COALESCE(data_resposta, now()), status = 'respondido',
         resposta_id = COALESCE(resposta_id, v_resp_id), updated_at = now()
   WHERE id = v_env.id;
  RETURN v_resp_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.responder_avaliacao_por_token(text, jsonb, text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_avaliacao_envio_por_token(text) TO anon, authenticated;