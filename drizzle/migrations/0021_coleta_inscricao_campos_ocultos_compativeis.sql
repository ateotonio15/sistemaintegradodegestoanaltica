CREATE OR REPLACE FUNCTION public.inscrever_coleta(p_token text, p_nome text, p_cpf text, p_nascimento date, p_telefone text, p_setor text, p_consentimento boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE info jsonb; a record; cpf_limpo text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
BEGIN
  info := public.get_coleta_por_token(p_token);
  IF info IS NULL THEN RETURN jsonb_build_object('erro','Link inválido'); END IF;
  IF info->>'bloqueio' IS NOT NULL THEN RETURN jsonb_build_object('erro', info->>'bloqueio'); END IF;
  IF NOT coalesce(p_consentimento,false) THEN RETURN jsonb_build_object('erro','Consentimento obrigatório'); END IF;
  IF length(cpf_limpo) <> 11 OR length(trim(coalesce(p_nome,''))) < 3 OR length(p_nome) > 150
     OR length(coalesce(p_setor,'')) > 100 THEN
    RETURN jsonb_build_object('erro','Dados inválidos'); END IF;
  SELECT id, empresa_id INTO a FROM coleta_agendamentos WHERE token = p_token;
  IF EXISTS (SELECT 1 FROM coleta_inscricoes WHERE agendamento_id = a.id AND cpf = cpf_limpo) THEN
    RETURN jsonb_build_object('erro','duplicado'); END IF;
  INSERT INTO coleta_inscricoes (agendamento_id, empresa_id, nome, cpf, data_nascimento, telefone, setor, consentimento)
  VALUES (a.id, a.empresa_id, upper(trim(p_nome)), cpf_limpo, coalesce(p_nascimento, DATE '1900-01-01'), coalesce(regexp_replace(p_telefone,'\D','','g'), ''), nullif(trim(p_setor),''), true);
  RETURN jsonb_build_object('ok', true) || info;
END $function$;