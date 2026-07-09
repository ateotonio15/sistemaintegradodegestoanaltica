
-- =========================================================
-- 1. TABELAS
-- =========================================================
CREATE TABLE public.notificacoes_saude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_source text NOT NULL CHECK (event_source IN ('palestra','acao_preventiva')),
  event_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('palestra','psa','sinais_vitais','outubro_rosa','novembro_azul','vacinacao','sipat','preventivo','outro')),
  status_notif text NOT NULL CHECK (status_notif IN ('novo','atualizado','cancelado')),
  empresa_id uuid,
  nome_empresa text NOT NULL,
  data_evento date,
  hora_inicio time,
  hora_fim time,
  local text,
  tema text,
  campanha text,
  responsavel text,
  executiva text,
  motivo_cancelamento text,
  titulo text NOT NULL,
  mensagem text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_saude_created ON public.notificacoes_saude(created_at DESC);
CREATE INDEX idx_notif_saude_event ON public.notificacoes_saude(event_source, event_id);

GRANT SELECT ON public.notificacoes_saude TO authenticated;
GRANT ALL ON public.notificacoes_saude TO service_role;

ALTER TABLE public.notificacoes_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_saude_select_enfermeira_admin"
  ON public.notificacoes_saude FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'enfermeira'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Nenhuma policy de INSERT/UPDATE/DELETE: triggers rodam como SECURITY DEFINER.

CREATE TABLE public.notificacoes_saude_lidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes_saude(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (notificacao_id, user_id)
);
CREATE INDEX idx_notif_saude_lidas_user ON public.notificacoes_saude_lidas(user_id);

GRANT SELECT, INSERT, DELETE ON public.notificacoes_saude_lidas TO authenticated;
GRANT ALL ON public.notificacoes_saude_lidas TO service_role;

ALTER TABLE public.notificacoes_saude_lidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_saude_lidas_own_select"
  ON public.notificacoes_saude_lidas FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_saude_lidas_own_insert"
  ON public.notificacoes_saude_lidas FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_saude_lidas_own_delete"
  ON public.notificacoes_saude_lidas FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =========================================================
-- 2. REALTIME
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_saude;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_saude_lidas;

-- =========================================================
-- 3. TRIGGER: PALESTRAS_SAUDE
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_notif_palestras_saude()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_status text;
  v_mensagem text;
  v_data date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_status := 'novo';
    v_titulo := '🟢 Nova Palestra cadastrada';
    v_data := NEW.data;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Cancelamento?
    IF NEW.status = 'cancelado' AND COALESCE(OLD.status::text,'') <> 'cancelado' THEN
      v_status := 'cancelado';
      v_titulo := '🔴 Palestra Cancelada';
    ELSE
      -- Só notifica se mudou algo relevante
      IF NEW.empresa IS NOT DISTINCT FROM OLD.empresa
         AND NEW.data IS NOT DISTINCT FROM OLD.data
         AND NEW.horario_inicio IS NOT DISTINCT FROM OLD.horario_inicio
         AND NEW.horario_fim IS NOT DISTINCT FROM OLD.horario_fim
         AND NEW.endereco IS NOT DISTINCT FROM OLD.endereco
         AND NEW.tema IS NOT DISTINCT FROM OLD.tema
         AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
      END IF;
      v_status := 'atualizado';
      v_titulo := '🟡 Palestra Atualizada';
    END IF;
    v_data := NEW.data;
  ELSIF TG_OP = 'DELETE' THEN
    v_status := 'cancelado';
    v_titulo := '🔴 Palestra Removida';
    v_data := OLD.data;
  END IF;

  v_mensagem := 'Empresa: ' || COALESCE(NEW.empresa, OLD.empresa);
  IF v_data IS NOT NULL THEN
    v_mensagem := v_mensagem || ' · ' || to_char(v_data, 'DD/MM/YYYY');
  END IF;

  INSERT INTO public.notificacoes_saude (
    event_source, event_id, event_type, status_notif,
    nome_empresa, data_evento, hora_inicio, hora_fim,
    local, tema, responsavel, executiva, motivo_cancelamento,
    titulo, mensagem
  ) VALUES (
    'palestra',
    COALESCE(NEW.id, OLD.id),
    'palestra',
    v_status,
    COALESCE(NEW.empresa, OLD.empresa),
    v_data,
    COALESCE(NEW.horario_inicio, OLD.horario_inicio),
    COALESCE(NEW.horario_fim, OLD.horario_fim),
    COALESCE(NEW.endereco, OLD.endereco),
    COALESCE(NEW.tema, OLD.tema),
    COALESCE(NEW.criado_por, OLD.criado_por),
    COALESCE(NEW.executiva, OLD.executiva),
    CASE WHEN v_status = 'cancelado' THEN COALESCE(NEW.motivo_cancelamento, OLD.motivo_cancelamento) END,
    v_titulo,
    v_mensagem
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_notif_palestras_saude
AFTER INSERT OR UPDATE OR DELETE ON public.palestras_saude
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_palestras_saude();

-- =========================================================
-- 4. TRIGGER: ACOES_PREVENTIVAS
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_notif_acoes_preventivas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_status text;
  v_mensagem text;
  v_empresa_nome text;
  v_event_type text;
  v_tipo_label text;
  v_data date;
BEGIN
  -- Nome da empresa
  SELECT nome INTO v_empresa_nome
  FROM public.empresas
  WHERE id = COALESCE(NEW.empresa_id, OLD.empresa_id);
  v_empresa_nome := COALESCE(v_empresa_nome, 'Empresa');

  -- Mapear tipo → event_type (enum atual: psa, sinais_vitais, preventivo)
  v_event_type := COALESCE(NEW.tipo::text, OLD.tipo::text);
  v_tipo_label := CASE v_event_type
    WHEN 'psa' THEN 'PSA'
    WHEN 'sinais_vitais' THEN 'Sinais Vitais'
    WHEN 'preventivo' THEN 'Ação Preventiva'
    ELSE 'Ação'
  END;

  IF TG_OP = 'INSERT' THEN
    v_status := 'novo';
    v_titulo := '🟢 Nova Ação · ' || v_tipo_label;
    v_data := NEW.data;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelado' AND COALESCE(OLD.status::text,'') <> 'cancelado' THEN
      v_status := 'cancelado';
      v_titulo := '🔴 Ação Cancelada · ' || v_tipo_label;
    ELSE
      IF NEW.empresa_id IS NOT DISTINCT FROM OLD.empresa_id
         AND NEW.data IS NOT DISTINCT FROM OLD.data
         AND NEW.horario_inicio IS NOT DISTINCT FROM OLD.horario_inicio
         AND NEW.horario_fim IS NOT DISTINCT FROM OLD.horario_fim
         AND NEW.endereco IS NOT DISTINCT FROM OLD.endereco
         AND NEW.tipo IS NOT DISTINCT FROM OLD.tipo
         AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
        RETURN NEW;
      END IF;
      v_status := 'atualizado';
      v_titulo := '🟡 Ação Atualizada · ' || v_tipo_label;
    END IF;
    v_data := NEW.data;
  ELSIF TG_OP = 'DELETE' THEN
    v_status := 'cancelado';
    v_titulo := '🔴 Ação Removida · ' || v_tipo_label;
    v_data := OLD.data;
  END IF;

  v_mensagem := 'Empresa: ' || v_empresa_nome;
  IF v_data IS NOT NULL THEN
    v_mensagem := v_mensagem || ' · ' || to_char(v_data, 'DD/MM/YYYY');
  END IF;

  INSERT INTO public.notificacoes_saude (
    event_source, event_id, event_type, status_notif,
    empresa_id, nome_empresa, data_evento, hora_inicio, hora_fim,
    local, tema, responsavel, executiva, motivo_cancelamento,
    titulo, mensagem
  ) VALUES (
    'acao_preventiva',
    COALESCE(NEW.id, OLD.id),
    v_event_type,
    v_status,
    COALESCE(NEW.empresa_id, OLD.empresa_id),
    v_empresa_nome,
    v_data,
    COALESCE(NEW.horario_inicio, OLD.horario_inicio),
    COALESCE(NEW.horario_fim, OLD.horario_fim),
    COALESCE(NEW.endereco, OLD.endereco),
    NULL,
    COALESCE(NEW.created_by_nome, OLD.created_by_nome, NEW.updated_by_nome, OLD.updated_by_nome),
    COALESCE(NEW.executiva_nome, OLD.executiva_nome),
    CASE WHEN v_status = 'cancelado' THEN COALESCE(NEW.motivo_cancelamento, OLD.motivo_cancelamento) END,
    v_titulo,
    v_mensagem
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_notif_acoes_preventivas
AFTER INSERT OR UPDATE OR DELETE ON public.acoes_preventivas
FOR EACH ROW EXECUTE FUNCTION public.trg_notif_acoes_preventivas();
