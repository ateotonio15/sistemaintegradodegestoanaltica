
-- 1) cs_sinistralidade_historico
CREATE TABLE public.cs_sinistralidade_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  contrato text,
  mes text NOT NULL,
  ano integer NOT NULL,
  sinistralidade numeric,
  percentual_reajuste numeric,
  indexador text,
  observacao text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_sinistralidade_historico TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_sinistralidade_historico TO anon;
GRANT ALL ON public.cs_sinistralidade_historico TO service_role;
ALTER TABLE public.cs_sinistralidade_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_sh_all_select" ON public.cs_sinistralidade_historico FOR SELECT USING (true);
CREATE POLICY "cs_sh_all_insert" ON public.cs_sinistralidade_historico FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_sh_all_update" ON public.cs_sinistralidade_historico FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_sh_all_delete" ON public.cs_sinistralidade_historico FOR DELETE USING (true);

-- 2) cs_sinistralidade_mensal
CREATE TABLE public.cs_sinistralidade_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  mes_referencia integer NOT NULL,
  ano_referencia integer NOT NULL,
  sinistralidade_percentual numeric,
  reajuste_percentual numeric,
  data_registro timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_sinistralidade_mensal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_sinistralidade_mensal TO anon;
GRANT ALL ON public.cs_sinistralidade_mensal TO service_role;
ALTER TABLE public.cs_sinistralidade_mensal ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_sm_all_select" ON public.cs_sinistralidade_mensal FOR SELECT USING (true);
CREATE POLICY "cs_sm_all_insert" ON public.cs_sinistralidade_mensal FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_sm_all_update" ON public.cs_sinistralidade_mensal FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_sm_all_delete" ON public.cs_sinistralidade_mensal FOR DELETE USING (true);

-- 3) cs_avaliacao_risco
CREATE TABLE public.cs_avaliacao_risco (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id text NOT NULL,
  semaforo text,
  sinistralidade_classificacao text,
  reclamacoes text,
  relacionamento text,
  satisfacao text,
  renovacao_proximidade text,
  pontuacao_total integer,
  classificacao_final text,
  data_avaliacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_risco TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_risco TO anon;
GRANT ALL ON public.cs_avaliacao_risco TO service_role;
ALTER TABLE public.cs_avaliacao_risco ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_ar_all_select" ON public.cs_avaliacao_risco FOR SELECT USING (true);
CREATE POLICY "cs_ar_all_insert" ON public.cs_avaliacao_risco FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_ar_all_update" ON public.cs_avaliacao_risco FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_ar_all_delete" ON public.cs_avaliacao_risco FOR DELETE USING (true);

-- 4) cs_avaliacoes_executiva
CREATE TABLE public.cs_avaliacoes_executiva (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  contrato text,
  relacionamento text,
  satisfacao text,
  observacao text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacoes_executiva TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacoes_executiva TO anon;
GRANT ALL ON public.cs_avaliacoes_executiva TO service_role;
ALTER TABLE public.cs_avaliacoes_executiva ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_ae_all_select" ON public.cs_avaliacoes_executiva FOR SELECT USING (true);
CREATE POLICY "cs_ae_all_insert" ON public.cs_avaliacoes_executiva FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_ae_all_update" ON public.cs_avaliacoes_executiva FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_ae_all_delete" ON public.cs_avaliacoes_executiva FOR DELETE USING (true);

-- 5) cs_avaliacao_formularios
CREATE TABLE public.cs_avaliacao_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  instrucoes text,
  perguntas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_formularios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_formularios TO anon;
GRANT ALL ON public.cs_avaliacao_formularios TO service_role;
ALTER TABLE public.cs_avaliacao_formularios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_af_all_select" ON public.cs_avaliacao_formularios FOR SELECT USING (true);
CREATE POLICY "cs_af_all_insert" ON public.cs_avaliacao_formularios FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_af_all_update" ON public.cs_avaliacao_formularios FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_af_all_delete" ON public.cs_avaliacao_formularios FOR DELETE USING (true);

-- 6) cs_avaliacao_respostas
CREATE TABLE public.cs_avaliacao_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.cs_avaliacao_formularios(id) ON DELETE CASCADE,
  respondente text,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_respostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cs_avaliacao_respostas TO anon;
GRANT ALL ON public.cs_avaliacao_respostas TO service_role;
ALTER TABLE public.cs_avaliacao_respostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_resp_all_select" ON public.cs_avaliacao_respostas FOR SELECT USING (true);
CREATE POLICY "cs_resp_all_insert" ON public.cs_avaliacao_respostas FOR INSERT WITH CHECK (true);
CREATE POLICY "cs_resp_all_update" ON public.cs_avaliacao_respostas FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cs_resp_all_delete" ON public.cs_avaliacao_respostas FOR DELETE USING (true);

-- updated_at trigger (shared helper if not exists)
CREATE OR REPLACE FUNCTION public.cs_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER cs_sm_set_updated BEFORE UPDATE ON public.cs_sinistralidade_mensal FOR EACH ROW EXECUTE FUNCTION public.cs_set_updated_at();
CREATE TRIGGER cs_ar_set_updated BEFORE UPDATE ON public.cs_avaliacao_risco FOR EACH ROW EXECUTE FUNCTION public.cs_set_updated_at();
CREATE TRIGGER cs_af_set_updated BEFORE UPDATE ON public.cs_avaliacao_formularios FOR EACH ROW EXECUTE FUNCTION public.cs_set_updated_at();
