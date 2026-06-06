
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.ferias_status AS ENUM ('programada','em_andamento','encerrada','aguardando_retorno_contratos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ferias_empresa_status AS ENUM ('pendente_inicio','redistribuida','aguardando_fechamento','retornada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ FERIAS CABECALHO ============
CREATE TABLE IF NOT EXISTS public.ferias_cadastro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsavel_original_user_id uuid NOT NULL,
  responsavel_original_nome text NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  status public.ferias_status NOT NULL DEFAULT 'programada',
  criado_por_user_id uuid,
  criado_por_nome text,
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

GRANT SELECT ON public.ferias_cadastro TO authenticated;
GRANT ALL ON public.ferias_cadastro TO service_role;
ALTER TABLE public.ferias_cadastro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_select_all_auth" ON public.ferias_cadastro;
CREATE POLICY "ferias_select_all_auth" ON public.ferias_cadastro
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ferias_admin_diretora_insert" ON public.ferias_cadastro;
CREATE POLICY "ferias_admin_diretora_insert" ON public.ferias_cadastro
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role));

DROP POLICY IF EXISTS "ferias_admin_diretora_update" ON public.ferias_cadastro;
CREATE POLICY "ferias_admin_diretora_update" ON public.ferias_cadastro
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role));

DROP POLICY IF EXISTS "ferias_admin_delete" ON public.ferias_cadastro;
CREATE POLICY "ferias_admin_delete" ON public.ferias_cadastro
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_ferias_cadastro_updated_at ON public.ferias_cadastro;
CREATE TRIGGER trg_ferias_cadastro_updated_at BEFORE UPDATE ON public.ferias_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FERIAS EMPRESAS ============
CREATE TABLE IF NOT EXISTS public.ferias_cadastro_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ferias_id uuid NOT NULL REFERENCES public.ferias_cadastro(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  responsavel_original_user_id uuid NOT NULL,
  responsavel_temporario_user_id uuid NOT NULL,
  responsavel_temporario_nome text,
  status public.ferias_empresa_status NOT NULL DEFAULT 'pendente_inicio',
  redistribuida_em timestamptz,
  retornada_em timestamptz,
  motivo_retencao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ferias_empresas_ferias ON public.ferias_cadastro_empresas(ferias_id);
CREATE INDEX IF NOT EXISTS idx_ferias_empresas_empresa ON public.ferias_cadastro_empresas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ferias_empresas_status ON public.ferias_cadastro_empresas(status);

GRANT SELECT ON public.ferias_cadastro_empresas TO authenticated;
GRANT ALL ON public.ferias_cadastro_empresas TO service_role;
ALTER TABLE public.ferias_cadastro_empresas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ferias_emp_select" ON public.ferias_cadastro_empresas;
CREATE POLICY "ferias_emp_select" ON public.ferias_cadastro_empresas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "ferias_emp_admin_diretora_write" ON public.ferias_cadastro_empresas;
CREATE POLICY "ferias_emp_admin_diretora_write" ON public.ferias_cadastro_empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role));

DROP TRIGGER IF EXISTS trg_ferias_emp_updated_at ON public.ferias_cadastro_empresas;
CREATE TRIGGER trg_ferias_emp_updated_at BEFORE UPDATE ON public.ferias_cadastro_empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPER: tem movimentacao pendente ============
CREATE OR REPLACE FUNCTION public.tem_movimentacao_pendente(p_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.movimentacoes m
     WHERE m.empresa_id = p_empresa_id
       AND m.data_envio_financeiro IS NULL
       AND m.mes_referencia >= to_char(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')
  ) OR EXISTS (
    SELECT 1 FROM public.financeiro_movimentacoes fm
     WHERE fm.empresa_id = p_empresa_id
       AND fm.data_envio_nota IS NULL
       AND fm.mes_referencia >= to_char(CURRENT_DATE - INTERVAL '1 month','YYYY-MM')
  );
$$;

-- ============ WORKLOAD ============
CREATE OR REPLACE FUNCTION public.get_cadastro_workload()
RETURNS TABLE(user_id uuid, display_name text, empresas bigint, implantacoes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id,
         COALESCE(p.display_name,'Sem nome') AS display_name,
         (SELECT count(*) FROM public.empresas e
            WHERE e.responsavel_user_id = p.user_id AND e.status_empresa = 'Ativa') AS empresas,
         (SELECT count(*) FROM public.implantacoes_contratos i
            WHERE i.responsavel_cadastro_user_id = p.user_id
              AND i.status NOT IN ('implantado','rejeitado')) AS implantacoes
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'comum'::app_role
  ORDER BY display_name;
$$;

-- ============ SIMULAR REDISTRIBUICAO ============
CREATE OR REPLACE FUNCTION public.simular_redistribuicao_ferias(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_antes jsonb;
  v_atribuicoes jsonb := '[]'::jsonb;
  v_depois jsonb;
  v_destinos jsonb := '[]'::jsonb;
  rec record;
  emp record;
  best_idx int;
  best_load numeric;
  cur_load numeric;
  cur_dest jsonb;
  destinos_arr jsonb[];
  i int;
BEGIN
  -- carga antes
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', user_id, 'nome', display_name,
    'empresas', empresas, 'implantacoes', implantacoes,
    'empresas_depois', CASE WHEN user_id = p_user_id THEN 0 ELSE empresas END
  )) INTO v_antes FROM public.get_cadastro_workload();

  -- inicializa destinos (todos exceto o de ferias)
  destinos_arr := ARRAY[]::jsonb[];
  FOR rec IN
    SELECT user_id, display_name, empresas, implantacoes
      FROM public.get_cadastro_workload()
     WHERE user_id <> p_user_id
  LOOP
    destinos_arr := destinos_arr || jsonb_build_object(
      'user_id', rec.user_id,
      'nome', rec.display_name,
      'carga', (rec.empresas + 0.5 * rec.implantacoes),
      'empresas_inicial', rec.empresas,
      'empresas_recebidas', 0
    );
  END LOOP;

  IF array_length(destinos_arr,1) IS NULL THEN
    RETURN jsonb_build_object('antes', v_antes, 'depois', v_antes, 'atribuicoes', '[]'::jsonb, 'erro', 'Nenhum destino disponível');
  END IF;

  -- atribuir empresas do usuário de ferias ao destino com menor carga
  FOR emp IN
    SELECT e.id, e.nome
      FROM public.empresas e
     WHERE e.responsavel_user_id = p_user_id AND e.status_empresa = 'Ativa'
     ORDER BY e.nome
  LOOP
    best_idx := 1; best_load := (destinos_arr[1]->>'carga')::numeric;
    FOR i IN 2..array_length(destinos_arr,1) LOOP
      cur_load := (destinos_arr[i]->>'carga')::numeric;
      IF cur_load < best_load THEN best_load := cur_load; best_idx := i; END IF;
    END LOOP;
    cur_dest := destinos_arr[best_idx];
    destinos_arr[best_idx] := jsonb_set(
      jsonb_set(cur_dest, '{carga}', to_jsonb(((cur_dest->>'carga')::numeric) + 1)),
      '{empresas_recebidas}', to_jsonb(((cur_dest->>'empresas_recebidas')::int) + 1)
    );
    v_atribuicoes := v_atribuicoes || jsonb_build_array(jsonb_build_object(
      'empresa_id', emp.id,
      'empresa_nome', emp.nome,
      'responsavel_temp_id', cur_dest->>'user_id',
      'responsavel_temp_nome', cur_dest->>'nome'
    ));
  END LOOP;

  v_depois := to_jsonb(destinos_arr);
  RETURN jsonb_build_object('antes', v_antes, 'depois', v_depois, 'atribuicoes', v_atribuicoes);
END;
$$;

-- ============ CRIAR FERIAS ============
CREATE OR REPLACE FUNCTION public.criar_ferias_cadastro(
  p_user_id uuid, p_nome text, p_data_inicio date, p_data_fim date, p_atribuicoes jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_ferias_id uuid;
  v_aplicar_agora boolean;
  item jsonb;
  v_emp_id uuid; v_temp_id uuid; v_temp_nome text;
  v_original_atual uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'diretora'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Admin ou Diretora podem criar férias';
  END IF;
  IF p_data_inicio IS NULL OR p_data_fim IS NULL THEN RAISE EXCEPTION 'Datas obrigatórias'; END IF;
  IF p_data_fim < p_data_inicio THEN RAISE EXCEPTION 'Data fim < início'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  v_aplicar_agora := (p_data_inicio <= CURRENT_DATE);

  INSERT INTO public.ferias_cadastro (
    responsavel_original_user_id, responsavel_original_nome, data_inicio, data_fim,
    status, criado_por_user_id, criado_por_nome, iniciada_em
  ) VALUES (
    p_user_id, p_nome, p_data_inicio, p_data_fim,
    CASE WHEN v_aplicar_agora THEN 'em_andamento'::ferias_status ELSE 'programada'::ferias_status END,
    v_uid, v_user_nome,
    CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
  ) RETURNING id INTO v_ferias_id;

  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(p_atribuicoes,'[]'::jsonb)) LOOP
    v_emp_id := (item->>'empresa_id')::uuid;
    v_temp_id := (item->>'responsavel_temp_id')::uuid;
    v_temp_nome := item->>'responsavel_temp_nome';

    SELECT responsavel_user_id INTO v_original_atual FROM public.empresas WHERE id = v_emp_id;
    IF v_original_atual IS NULL OR v_original_atual <> p_user_id THEN CONTINUE; END IF;

    INSERT INTO public.ferias_cadastro_empresas (
      ferias_id, empresa_id, responsavel_original_user_id, responsavel_temporario_user_id, responsavel_temporario_nome,
      status, redistribuida_em
    ) VALUES (
      v_ferias_id, v_emp_id, p_user_id, v_temp_id, v_temp_nome,
      CASE WHEN v_aplicar_agora THEN 'redistribuida'::ferias_empresa_status ELSE 'pendente_inicio'::ferias_empresa_status END,
      CASE WHEN v_aplicar_agora THEN now() ELSE NULL END
    );

    IF v_aplicar_agora THEN
      UPDATE public.empresas SET responsavel_user_id = v_temp_id, updated_at = now() WHERE id = v_emp_id;
    END IF;
  END LOOP;

  -- Notificacoes (usa tabela existente notificacoes; tipo livre)
  BEGIN
    INSERT INTO public.notificacoes (tipo, empresa_id, nome_empresa, codigo_contrato, responsavel_contrato, data_implantacao)
    VALUES ('ferias_iniciada', NULL, p_nome, NULL, p_nome, p_data_inicio::text);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN v_ferias_id;
END;
$$;

-- ============ APLICAR FERIAS PROGRAMADAS ============
CREATE OR REPLACE FUNCTION public.aplicar_ferias_programadas()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f record; e record; v_count int := 0;
BEGIN
  FOR f IN SELECT * FROM public.ferias_cadastro
           WHERE status = 'programada' AND data_inicio <= CURRENT_DATE LOOP
    UPDATE public.ferias_cadastro
       SET status = 'em_andamento', iniciada_em = now(), updated_at = now()
     WHERE id = f.id;
    FOR e IN SELECT * FROM public.ferias_cadastro_empresas
             WHERE ferias_id = f.id AND status = 'pendente_inicio' LOOP
      UPDATE public.empresas SET responsavel_user_id = e.responsavel_temporario_user_id, updated_at = now()
       WHERE id = e.empresa_id;
      UPDATE public.ferias_cadastro_empresas
         SET status = 'redistribuida', redistribuida_em = now(), updated_at = now()
       WHERE id = e.id;
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============ PROCESSAR RETORNO ============
CREATE OR REPLACE FUNCTION public.processar_retorno_ferias()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f record; e record; v_count int := 0; v_pendentes int;
BEGIN
  FOR f IN SELECT * FROM public.ferias_cadastro
           WHERE status IN ('em_andamento','aguardando_retorno_contratos')
             AND data_fim < CURRENT_DATE LOOP
    FOR e IN SELECT * FROM public.ferias_cadastro_empresas
             WHERE ferias_id = f.id AND status IN ('redistribuida','aguardando_fechamento') LOOP
      IF public.tem_movimentacao_pendente(e.empresa_id) THEN
        UPDATE public.ferias_cadastro_empresas
           SET status = 'aguardando_fechamento',
               motivo_retencao = 'Movimentação/Nota pendente',
               updated_at = now()
         WHERE id = e.id;
      ELSE
        UPDATE public.empresas SET responsavel_user_id = e.responsavel_original_user_id, updated_at = now()
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
      UPDATE public.ferias_cadastro SET status = 'encerrada', encerrada_em = now(), updated_at = now() WHERE id = f.id;
    ELSE
      UPDATE public.ferias_cadastro SET status = 'aguardando_retorno_contratos', updated_at = now() WHERE id = f.id;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- ============ TRIGGER: ao concluir movimentacao, tenta devolver ============
CREATE OR REPLACE FUNCTION public.trg_ferias_check_retorno()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record;
BEGIN
  IF NEW.data_envio_financeiro IS NULL THEN RETURN NEW; END IF;
  FOR e IN SELECT fce.* FROM public.ferias_cadastro_empresas fce
            JOIN public.ferias_cadastro fc ON fc.id = fce.ferias_id
           WHERE fce.empresa_id = NEW.empresa_id
             AND fce.status = 'aguardando_fechamento'
             AND fc.data_fim < CURRENT_DATE LOOP
    IF NOT public.tem_movimentacao_pendente(e.empresa_id) THEN
      UPDATE public.empresas SET responsavel_user_id = e.responsavel_original_user_id, updated_at = now()
       WHERE id = e.empresa_id;
      UPDATE public.ferias_cadastro_empresas
         SET status = 'retornada', retornada_em = now(), updated_at = now()
       WHERE id = e.id;
      -- fecha cabeçalho se não há mais pendência
      UPDATE public.ferias_cadastro fc
         SET status = 'encerrada', encerrada_em = now(), updated_at = now()
       WHERE fc.id = e.ferias_id
         AND NOT EXISTS (SELECT 1 FROM public.ferias_cadastro_empresas x
                          WHERE x.ferias_id = fc.id AND x.status <> 'retornada');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ferias_check_retorno ON public.movimentacoes;
CREATE TRIGGER trg_ferias_check_retorno AFTER INSERT OR UPDATE OF data_envio_financeiro ON public.movimentacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_ferias_check_retorno();
