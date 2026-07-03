
-- Enum de status
DO $$ BEGIN
  CREATE TYPE public.agendamento_plantao_status AS ENUM ('a_confirmar','confirmado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela
CREATE TABLE public.agendamentos_plantao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  empresa_nome text NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  executiva text,
  status public.agendamento_plantao_status NOT NULL DEFAULT 'a_confirmar',
  observacao text,
  motivo_cancelamento text,
  criado_por text,
  editado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agendamentos_plantao_data ON public.agendamentos_plantao(data);
CREATE INDEX idx_agendamentos_plantao_empresa ON public.agendamentos_plantao(empresa_id);
CREATE INDEX idx_agendamentos_plantao_executiva ON public.agendamentos_plantao(executiva);

-- Validação: hora_fim > hora_inicio; se cancelado exige motivo
CREATE OR REPLACE FUNCTION public.validate_agendamento_plantao()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.hora_fim <= NEW.hora_inicio THEN
    RAISE EXCEPTION 'Horário de término deve ser maior que o de início';
  END IF;
  IF NEW.status = 'cancelado' AND (NEW.motivo_cancelamento IS NULL OR btrim(NEW.motivo_cancelamento) = '') THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório quando o status é cancelado';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_validate_agendamento_plantao
BEFORE INSERT OR UPDATE ON public.agendamentos_plantao
FOR EACH ROW EXECUTE FUNCTION public.validate_agendamento_plantao();

-- updated_at
CREATE TRIGGER trg_agendamentos_plantao_updated_at
BEFORE UPDATE ON public.agendamentos_plantao
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos_plantao TO authenticated;
GRANT ALL ON public.agendamentos_plantao TO service_role;

-- RLS
ALTER TABLE public.agendamentos_plantao ENABLE ROW LEVEL SECURITY;

-- Leitura ampla: qualquer perfil autenticado exceto externo restrito
CREATE POLICY "Agendamentos: leitura ampla"
ON public.agendamentos_plantao FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'comum')
  OR public.has_role(auth.uid(), 'executivo')
  OR public.has_role(auth.uid(), 'coordenadora')
  OR public.has_role(auth.uid(), 'enfermeira')
  OR public.has_role(auth.uid(), 'financeiro')
  OR public.has_role(auth.uid(), 'visualizacao')
  OR public.has_role(auth.uid(), 'diretora')
  OR public.has_role(auth.uid(), 'diretora_saude')
  OR public.has_role(auth.uid(), 'administradoras')
  OR (
    public.has_role(auth.uid(), 'executivo_externo')
    AND executiva IS NOT NULL
    AND executiva IN (
      SELECT display_name FROM public.profiles WHERE user_id = auth.uid()
      UNION
      SELECT username FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);

-- Escrita: admin, comum, executivo, coordenadora
CREATE POLICY "Agendamentos: inserir"
ON public.agendamentos_plantao FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'comum')
  OR public.has_role(auth.uid(), 'executivo')
  OR public.has_role(auth.uid(), 'coordenadora')
);

CREATE POLICY "Agendamentos: atualizar"
ON public.agendamentos_plantao FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'comum')
  OR public.has_role(auth.uid(), 'executivo')
  OR public.has_role(auth.uid(), 'coordenadora')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'comum')
  OR public.has_role(auth.uid(), 'executivo')
  OR public.has_role(auth.uid(), 'coordenadora')
);

CREATE POLICY "Agendamentos: deletar"
ON public.agendamentos_plantao FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'comum')
  OR public.has_role(auth.uid(), 'executivo')
  OR public.has_role(auth.uid(), 'coordenadora')
);

-- Realtime
ALTER TABLE public.agendamentos_plantao REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos_plantao;
