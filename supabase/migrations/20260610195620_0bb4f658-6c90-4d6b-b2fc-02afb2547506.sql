
-- ============ Limpeza módulo antigo ============
DROP TABLE IF EXISTS public.saude_acoes CASCADE;
DROP TABLE IF EXISTS public.saude_agendamentos CASCADE;

-- ============ Novos roles ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='coordenadora' AND enumtypid='public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'coordenadora';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='diretora_saude' AND enumtypid='public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'diretora_saude';
  END IF;
END $$;

-- ============ Enums do módulo ============
DO $$ BEGIN
  CREATE TYPE public.acao_saude_tipo AS ENUM ('triagem','palestra','preventiva','bioimpedancia','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.acao_saude_status AS ENUM ('agendada','em_andamento','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ Funções clínicas ============
CREATE OR REPLACE FUNCTION public.calcular_imc(p_peso numeric, p_altura_cm int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_peso IS NULL OR p_altura_cm IS NULL OR p_altura_cm=0 THEN NULL
              ELSE ROUND((p_peso / ((p_altura_cm/100.0)*(p_altura_cm/100.0)))::numeric, 2) END;
$$;

CREATE OR REPLACE FUNCTION public.classificar_pa(p_pas int, p_pad int)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_pas IS NULL OR p_pad IS NULL THEN NULL
    WHEN p_pas >= 180 OR p_pad >= 110 THEN 'HA Estágio 3'
    WHEN p_pas >= 160 OR p_pad >= 100 THEN 'HA Estágio 2'
    WHEN p_pas >= 140 OR p_pad >= 90  THEN 'HA Estágio 1'
    WHEN p_pas >= 130 OR p_pad >= 85  THEN 'Limítrofe'
    WHEN p_pas >= 120 OR p_pad >= 80  THEN 'Normal'
    ELSE 'Ótima' END;
$$;

CREATE OR REPLACE FUNCTION public.classificar_glicemia(p_valor numeric, p_jejum boolean)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_valor IS NULL THEN NULL
    WHEN p_jejum THEN
      CASE WHEN p_valor < 70 THEN 'Hipoglicemia'
           WHEN p_valor < 100 THEN 'Normal'
           WHEN p_valor < 126 THEN 'Pré-Diabetes'
           ELSE 'Diabetes' END
    ELSE
      CASE WHEN p_valor < 140 THEN 'Normal'
           WHEN p_valor < 200 THEN 'Pré-Diabetes'
           ELSE 'Diabetes' END
  END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_rcq(p_abd numeric, p_qua numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_abd IS NULL OR p_qua IS NULL OR p_qua=0 THEN NULL
              ELSE ROUND((p_abd/p_qua)::numeric, 2) END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_idade(p_nasc date)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_nasc IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM age(CURRENT_DATE, p_nasc))::int END;
$$;

CREATE OR REPLACE FUNCTION public.is_saude_editor(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid,'admin'::app_role) OR public.has_role(_uid,'enfermeira'::app_role);
$$;

-- ============ Tabela acoes_saude ============
CREATE TABLE public.acoes_saude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  enfermeira_user_id uuid,
  enfermeira_nome text,
  data_acao date NOT NULL,
  hora_inicio time,
  hora_fim time,
  tipo public.acao_saude_tipo NOT NULL DEFAULT 'triagem',
  status public.acao_saude_status NOT NULL DEFAULT 'agendada',
  titulo text,
  local text,
  observacoes text,
  total_atendidos int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_saude TO authenticated;
GRANT ALL ON public.acoes_saude TO service_role;
ALTER TABLE public.acoes_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_saude_select_all" ON public.acoes_saude FOR SELECT TO authenticated USING (true);
CREATE POLICY "acoes_saude_ins" ON public.acoes_saude FOR INSERT TO authenticated WITH CHECK (public.is_saude_editor(auth.uid()));
CREATE POLICY "acoes_saude_upd" ON public.acoes_saude FOR UPDATE TO authenticated USING (public.is_saude_editor(auth.uid())) WITH CHECK (public.is_saude_editor(auth.uid()));
CREATE POLICY "acoes_saude_del" ON public.acoes_saude FOR DELETE TO authenticated USING (public.is_saude_editor(auth.uid()));

CREATE TRIGGER trg_acoes_saude_upd BEFORE UPDATE ON public.acoes_saude
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Tabela triagens ============
CREATE TABLE public.triagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES public.acoes_saude(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  -- identificação
  nome text NOT NULL,
  cpf text,
  data_nascimento date,
  idade int,
  sexo text,
  email text,
  telefone text,
  setor text,
  cargo text,
  -- antropometria
  peso_kg numeric(5,2),
  altura_cm int,
  imc numeric(5,2),
  circ_abdominal_cm numeric(5,2),
  circ_quadril_cm numeric(5,2),
  rcq numeric(5,2),
  gordura_pct numeric(5,2),
  gordura_corporal_kg numeric(5,2),
  gordura_subcutanea_pct numeric(5,2),
  gordura_visceral numeric(5,2),
  massa_muscular_kg numeric(5,2),
  massa_ossea_kg numeric(5,2),
  agua_corporal_pct numeric(5,2),
  tmb_kcal int,
  idade_metabolica int,
  score_corporal numeric(5,2),
  -- sinais vitais / exames
  pas_mmhg int,
  pad_mmhg int,
  classificacao_pa text,
  freq_cardiaca int,
  sat_o2 int,
  temperatura_c numeric(4,1),
  glicemia_mg_dl numeric(5,1),
  jejum boolean NOT NULL DEFAULT false,
  classificacao_glicemia text,
  -- histórico
  tem_has boolean NOT NULL DEFAULT false,
  tem_dm boolean NOT NULL DEFAULT false,
  usa_medicacao boolean NOT NULL DEFAULT false,
  medicamentos text,
  -- encaminhamento
  risco_geral text,
  recomendacao text,
  enviado_email_em timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_triagens_acao ON public.triagens(acao_id);
CREATE INDEX idx_triagens_empresa ON public.triagens(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.triagens TO authenticated;
GRANT ALL ON public.triagens TO service_role;
ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "triagens_select_all" ON public.triagens FOR SELECT TO authenticated USING (true);
CREATE POLICY "triagens_ins" ON public.triagens FOR INSERT TO authenticated WITH CHECK (public.is_saude_editor(auth.uid()));
CREATE POLICY "triagens_upd" ON public.triagens FOR UPDATE TO authenticated USING (public.is_saude_editor(auth.uid())) WITH CHECK (public.is_saude_editor(auth.uid()));
CREATE POLICY "triagens_del" ON public.triagens FOR DELETE TO authenticated USING (public.is_saude_editor(auth.uid()));

CREATE TRIGGER trg_triagens_upd BEFORE UPDATE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: calcula campos derivados
CREATE OR REPLACE FUNCTION public.trg_triagens_calc()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v_pa text; v_gli text; v_imc numeric;
BEGIN
  NEW.imc := public.calcular_imc(NEW.peso_kg, NEW.altura_cm);
  NEW.rcq := public.calcular_rcq(NEW.circ_abdominal_cm, NEW.circ_quadril_cm);
  IF NEW.data_nascimento IS NOT NULL THEN
    NEW.idade := public.calcular_idade(NEW.data_nascimento);
  END IF;
  NEW.classificacao_pa := public.classificar_pa(NEW.pas_mmhg, NEW.pad_mmhg);
  NEW.classificacao_glicemia := public.classificar_glicemia(NEW.glicemia_mg_dl, NEW.jejum);

  v_pa := NEW.classificacao_pa;
  v_gli := NEW.classificacao_glicemia;
  v_imc := NEW.imc;
  NEW.risco_geral := CASE
    WHEN v_pa IN ('HA Estágio 2','HA Estágio 3') OR v_gli = 'Diabetes' OR (v_imc IS NOT NULL AND v_imc >= 30) OR (NEW.tem_has AND NEW.tem_dm)
      THEN 'alto'
    WHEN v_pa IN ('Limítrofe','HA Estágio 1') OR v_gli = 'Pré-Diabetes' OR (v_imc IS NOT NULL AND v_imc >= 25) OR NEW.tem_has OR NEW.tem_dm
      THEN 'medio'
    ELSE 'baixo'
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_triagens_calc_bi BEFORE INSERT OR UPDATE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.trg_triagens_calc();

-- Recount atendidos
CREATE OR REPLACE FUNCTION public.recount_acao_atendidos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := COALESCE(NEW.acao_id, OLD.acao_id);
  UPDATE public.acoes_saude SET total_atendidos = (SELECT COUNT(*) FROM public.triagens WHERE acao_id = v_id), updated_at = now()
   WHERE id = v_id;
  RETURN NULL;
END $$;

CREATE TRIGGER trg_triagens_recount AFTER INSERT OR DELETE ON public.triagens
  FOR EACH ROW EXECUTE FUNCTION public.recount_acao_atendidos();
