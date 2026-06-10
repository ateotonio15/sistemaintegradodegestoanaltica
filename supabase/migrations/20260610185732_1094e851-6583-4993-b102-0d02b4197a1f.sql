
-- Plantões 24h: tabelas isoladas
CREATE TABLE public.plantoes_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plantoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.plantoes_empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  turno text NOT NULL DEFAULT 'integral',
  plantonista text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plantoes_empresa_data ON public.plantoes(empresa_id, data);

CREATE TABLE public.plantoes_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plantao_id uuid NOT NULL REFERENCES public.plantoes(id) ON DELETE CASCADE,
  hora time,
  nome_cliente text NOT NULL,
  cpf text,
  assunto text,
  resolvido boolean NOT NULL DEFAULT false,
  demanda_id uuid REFERENCES public.demandas(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plantoes_atend_plantao ON public.plantoes_atendimentos(plantao_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantoes_empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantoes_atendimentos TO authenticated;
GRANT ALL ON public.plantoes_empresas TO service_role;
GRANT ALL ON public.plantoes TO service_role;
GRANT ALL ON public.plantoes_atendimentos TO service_role;

-- RLS
ALTER TABLE public.plantoes_empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantoes_atendimentos ENABLE ROW LEVEL SECURITY;

-- Admin: full access. Others: read only.
CREATE POLICY "plantoes_empresas_admin_all" ON public.plantoes_empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plantoes_empresas_auth_read" ON public.plantoes_empresas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plantoes_admin_all" ON public.plantoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plantoes_auth_read" ON public.plantoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "plantoes_atend_admin_all" ON public.plantoes_atendimentos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "plantoes_atend_auth_read" ON public.plantoes_atendimentos
  FOR SELECT TO authenticated USING (true);

-- updated_at triggers
CREATE TRIGGER trg_plantoes_empresas_updated BEFORE UPDATE ON public.plantoes_empresas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plantoes_updated BEFORE UPDATE ON public.plantoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plantoes_atend_updated BEFORE UPDATE ON public.plantoes_atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.plantoes_empresas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plantoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.plantoes_atendimentos;
ALTER TABLE public.plantoes_empresas REPLICA IDENTITY FULL;
ALTER TABLE public.plantoes REPLICA IDENTITY FULL;
ALTER TABLE public.plantoes_atendimentos REPLICA IDENTITY FULL;
