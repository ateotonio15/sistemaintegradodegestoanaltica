-- Enums
DO $$ BEGIN
  CREATE TYPE public.acao_preventiva_tipo AS ENUM ('sinais_vitais','preventivo','psa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.acao_preventiva_status AS ENUM ('a_confirmar','confirmado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.acoes_preventivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  endereco text,
  tipo public.acao_preventiva_tipo NOT NULL,
  data date NOT NULL,
  horario_inicio time,
  horario_fim time,
  executiva_user_id uuid,
  executiva_nome text,
  observacao text,
  status public.acao_preventiva_status NOT NULL DEFAULT 'a_confirmar',
  motivo_cancelamento text,
  created_by uuid,
  created_by_nome text,
  updated_by uuid,
  updated_by_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_preventivas_data ON public.acoes_preventivas(data);
CREATE INDEX idx_acoes_preventivas_tipo_data ON public.acoes_preventivas(tipo, data);
CREATE INDEX idx_acoes_preventivas_empresa ON public.acoes_preventivas(empresa_id);
CREATE INDEX idx_acoes_preventivas_exec ON public.acoes_preventivas(executiva_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_preventivas TO authenticated;
GRANT ALL ON public.acoes_preventivas TO service_role;

ALTER TABLE public.acoes_preventivas ENABLE ROW LEVEL SECURITY;

-- SELECT: admin, executivo, enfermeira, diretora
CREATE POLICY "acoes_preventivas_select"
ON public.acoes_preventivas FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'executivo'::app_role)
  OR public.has_role(auth.uid(),'enfermeira'::app_role)
  OR public.has_role(auth.uid(),'diretora'::app_role)
);

-- INSERT/UPDATE/DELETE: admin, executivo, enfermeira (diretora não escreve)
CREATE POLICY "acoes_preventivas_insert"
ON public.acoes_preventivas FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'executivo'::app_role)
  OR public.has_role(auth.uid(),'enfermeira'::app_role)
);

CREATE POLICY "acoes_preventivas_update"
ON public.acoes_preventivas FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'executivo'::app_role)
  OR public.has_role(auth.uid(),'enfermeira'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'executivo'::app_role)
  OR public.has_role(auth.uid(),'enfermeira'::app_role)
);

CREATE POLICY "acoes_preventivas_delete"
ON public.acoes_preventivas FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'executivo'::app_role)
  OR public.has_role(auth.uid(),'enfermeira'::app_role)
);

-- Trigger updated_at
CREATE TRIGGER trg_acoes_preventivas_updated_at
BEFORE UPDATE ON public.acoes_preventivas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();