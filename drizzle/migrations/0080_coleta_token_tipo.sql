CREATE OR REPLACE FUNCTION public.get_coleta_por_token(p_token text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE a record; n int; motivo text := null;
BEGIN
  SELECT c.*, e.nome AS empresa_nome, ap.tipo::text AS tipo_acao INTO a
    FROM coleta_agendamentos c JOIN empresas e ON e.id = c.empresa_id
    LEFT JOIN acoes_preventivas ap ON ap.id = c.acao_preventiva_id
   WHERE c.token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO n FROM coleta_inscricoes WHERE agendamento_id = a.id AND status <> 'cancelada';
  IF NOT a.link_ativo OR a.status IN ('concluida','cancelada') THEN motivo := 'encerrado';
  ELSIF a.data_limite IS NOT NULL AND a.data_limite < (now() AT TIME ZONE 'America/Manaus')::date THEN motivo := 'prazo';
  ELSIF a.vagas IS NOT NULL AND n >= a.vagas THEN motivo := 'lotado';
  END IF;
  RETURN jsonb_build_object('empresa', a.empresa_nome, 'data', a.data, 'horario_inicio', a.horario_inicio,
    'horario_fim', a.horario_fim, 'local', a.local, 'bloqueio', motivo, 'tipo', a.tipo_acao);
END $function$;