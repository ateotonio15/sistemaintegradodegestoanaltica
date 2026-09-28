CREATE TABLE public.coleta_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  horario_inicio time,
  horario_fim time,
  responsavel text,
  local text,
  vagas integer,
  observacoes text,
  status text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','pendente','concluida','cancelada')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18),'hex'),
  link_ativo boolean NOT NULL DEFAULT true,
  data_limite date,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coleta_agendamentos TO authenticated;
GRANT ALL ON public.coleta_agendamentos TO service_role;
ALTER TABLE public.coleta_agendamentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.coleta_inscricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NOT NULL REFERENCES public.coleta_agendamentos(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL,
  data_nascimento date NOT NULL,
  telefone text NOT NULL,
  setor text,
  consentimento boolean NOT NULL DEFAULT false,
  origem text NOT NULL DEFAULT 'link',
  status text NOT NULL DEFAULT 'inscrita' CHECK (status IN ('inscrita','realizada','faltou','cancelada')),
  confirmado_em timestamptz,
  confirmado_por uuid,
  confirmado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agendamento_id, cpf)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coleta_inscricoes TO authenticated;
GRANT ALL ON public.coleta_inscricoes TO service_role;
ALTER TABLE public.coleta_inscricoes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_coleta(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid
    AND role IN ('admin','diretora','diretora_saude','enfermeira','tec_enfermagem','coordenadora','executivo'))
$$;

CREATE POLICY "coleta_ag_manage" ON public.coleta_agendamentos FOR ALL TO authenticated
  USING (public.can_manage_coleta(auth.uid())) WITH CHECK (public.can_manage_coleta(auth.uid()));
CREATE POLICY "coleta_insc_manage" ON public.coleta_inscricoes FOR ALL TO authenticated
  USING (public.can_manage_coleta(auth.uid())) WITH CHECK (public.can_manage_coleta(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_coleta_por_token(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; n int; motivo text := null;
BEGIN
  SELECT c.*, e.nome AS empresa_nome INTO a FROM coleta_agendamentos c JOIN empresas e ON e.id = c.empresa_id WHERE c.token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO n FROM coleta_inscricoes WHERE agendamento_id = a.id AND status <> 'cancelada';
  IF NOT a.link_ativo OR a.status IN ('concluida','cancelada') THEN motivo := 'encerrado';
  ELSIF a.data_limite IS NOT NULL AND a.data_limite < (now() AT TIME ZONE 'America/Manaus')::date THEN motivo := 'prazo';
  ELSIF a.vagas IS NOT NULL AND n >= a.vagas THEN motivo := 'lotado';
  END IF;
  RETURN jsonb_build_object('empresa', a.empresa_nome, 'data', a.data, 'horario_inicio', a.horario_inicio,
    'horario_fim', a.horario_fim, 'local', a.local, 'bloqueio', motivo);
END $$;

CREATE OR REPLACE FUNCTION public.inscrever_coleta(p_token text, p_nome text, p_cpf text, p_nascimento date, p_telefone text, p_setor text, p_consentimento boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE info jsonb; a record; cpf_limpo text := regexp_replace(coalesce(p_cpf,''), '\D', '', 'g');
BEGIN
  info := public.get_coleta_por_token(p_token);
  IF info IS NULL THEN RETURN jsonb_build_object('erro','Link inválido'); END IF;
  IF info->>'bloqueio' IS NOT NULL THEN RETURN jsonb_build_object('erro', info->>'bloqueio'); END IF;
  IF NOT coalesce(p_consentimento,false) THEN RETURN jsonb_build_object('erro','Consentimento obrigatório'); END IF;
  IF length(cpf_limpo) <> 11 OR length(trim(coalesce(p_nome,''))) < 3 OR length(p_nome) > 150
     OR length(regexp_replace(coalesce(p_telefone,''), '\D','','g')) < 10 OR p_nascimento IS NULL
     OR length(coalesce(p_setor,'')) > 100 THEN
    RETURN jsonb_build_object('erro','Dados inválidos'); END IF;
  SELECT id, empresa_id INTO a FROM coleta_agendamentos WHERE token = p_token;
  IF EXISTS (SELECT 1 FROM coleta_inscricoes WHERE agendamento_id = a.id AND cpf = cpf_limpo) THEN
    RETURN jsonb_build_object('erro','duplicado'); END IF;
  INSERT INTO coleta_inscricoes (agendamento_id, empresa_id, nome, cpf, data_nascimento, telefone, setor, consentimento)
  VALUES (a.id, a.empresa_id, upper(trim(p_nome)), cpf_limpo, p_nascimento, regexp_replace(p_telefone,'\D','','g'), nullif(trim(p_setor),''), true);
  RETURN jsonb_build_object('ok', true) || info;
END $$;

GRANT EXECUTE ON FUNCTION public.get_coleta_por_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inscrever_coleta(text,text,text,date,text,text,boolean) TO anon, authenticated;