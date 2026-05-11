
-- 1. Adicionar campos de fluxo
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS status_reajuste text NOT NULL DEFAULT 'pendente_confirmacao',
  ADD COLUMN IF NOT EXISTS confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS confirmado_por_nome text,
  ADD COLUMN IF NOT EXISTS data_confirmacao timestamptz;

-- Registros antigos contam como já confirmados
UPDATE public.reajustes_anuais
   SET status_reajuste = 'reajustado'
 WHERE status_reajuste = 'pendente_confirmacao'
   AND created_at < now();

-- 2. Policy para Comum confirmar reajustes das empresas que é responsável
DROP POLICY IF EXISTS "Comum confirm reajustes_anuais" ON public.reajustes_anuais;
CREATE POLICY "Comum confirm reajustes_anuais"
  ON public.reajustes_anuais
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'comum'::app_role)
    AND (
      EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'comum'::app_role)
    AND (
      EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = reajustes_anuais.empresa_id AND e.responsavel_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = reajustes_anuais.empresa_id AND eu.user_id = auth.uid())
    )
  );

-- 3. Trigger guard: Comum só pode alterar status/confirmação
CREATE OR REPLACE FUNCTION public.guard_reajuste_comum()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF public.has_role(v_uid, 'comum'::app_role)
     AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.ano IS DISTINCT FROM OLD.ano
       OR NEW.valor_antigo_centavos IS DISTINCT FROM OLD.valor_antigo_centavos
       OR NEW.percentual IS DISTINCT FROM OLD.percentual
       OR NEW.valor_reajustado_centavos IS DISTINCT FROM OLD.valor_reajustado_centavos
       OR NEW.data_aplicacao IS DISTINCT FROM OLD.data_aplicacao
       OR NEW.observacao IS DISTINCT FROM OLD.observacao
       OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
       OR NEW.usuario_nome IS DISTINCT FROM OLD.usuario_nome THEN
      RAISE EXCEPTION 'Cadastro só pode confirmar reajustes (não pode alterar valores)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_reajuste_comum ON public.reajustes_anuais;
CREATE TRIGGER trg_guard_reajuste_comum
  BEFORE UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.guard_reajuste_comum();

-- 4. Tabela alertas_reajuste
CREATE TABLE IF NOT EXISTS public.alertas_reajuste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reajuste_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  empresa_nome text NOT NULL,
  criado_por_user_id uuid,
  criado_por_nome text,
  destinatario_user_id uuid,
  status text NOT NULL DEFAULT 'Pendente',
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_reajuste_destinatario ON public.alertas_reajuste(destinatario_user_id, status);
CREATE INDEX IF NOT EXISTS idx_alertas_reajuste_reajuste ON public.alertas_reajuste(reajuste_id);

ALTER TABLE public.alertas_reajuste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Authenticated read alertas_reajuste"
  ON public.alertas_reajuste FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Admin manage alertas_reajuste"
  ON public.alertas_reajuste FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Visualizacao manage alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Visualizacao manage alertas_reajuste"
  ON public.alertas_reajuste FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'visualizacao'::app_role))
  WITH CHECK (has_role(auth.uid(), 'visualizacao'::app_role));

DROP POLICY IF EXISTS "Comum update own alertas_reajuste" ON public.alertas_reajuste;
CREATE POLICY "Comum update own alertas_reajuste"
  ON public.alertas_reajuste FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'comum'::app_role) AND destinatario_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'comum'::app_role) AND destinatario_user_id = auth.uid());

CREATE TRIGGER trg_alertas_reajuste_updated_at
  BEFORE UPDATE ON public.alertas_reajuste
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger criar alerta após INSERT em reajustes_anuais
CREATE OR REPLACE FUNCTION public.trg_criar_alerta_reajuste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_nome text;
  v_responsavel uuid;
  v_user_nome text;
BEGIN
  IF NEW.status_reajuste <> 'pendente_confirmacao' THEN
    RETURN NEW;
  END IF;

  SELECT nome, responsavel_user_id INTO v_empresa_nome, v_responsavel
    FROM public.empresas WHERE id = NEW.empresa_id;

  IF v_empresa_nome IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO v_user_nome
    FROM public.profiles WHERE user_id = NEW.usuario_id;

  INSERT INTO public.alertas_reajuste
    (reajuste_id, empresa_id, empresa_nome, criado_por_user_id, criado_por_nome, destinatario_user_id, status)
  VALUES
    (NEW.id, NEW.empresa_id, v_empresa_nome, NEW.usuario_id, COALESCE(v_user_nome, NEW.usuario_nome), v_responsavel, 'Pendente');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_criar_alerta_reajuste
  AFTER INSERT ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_criar_alerta_reajuste();

-- 6. Trigger finalizar alerta quando reajuste é confirmado
CREATE OR REPLACE FUNCTION public.trg_finalizar_alerta_reajuste()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status_reajuste = 'reajustado'
     AND OLD.status_reajuste IS DISTINCT FROM NEW.status_reajuste THEN
    UPDATE public.alertas_reajuste
       SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
     WHERE reajuste_id = NEW.id AND status = 'Pendente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finalizar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_finalizar_alerta_reajuste
  AFTER UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_finalizar_alerta_reajuste();

-- 7. Realtime
ALTER TABLE public.reajustes_anuais REPLICA IDENTITY FULL;
ALTER TABLE public.alertas_reajuste REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reajustes_anuais;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas_reajuste;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
