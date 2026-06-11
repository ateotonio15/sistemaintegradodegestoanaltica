
-- Tabela de histórico imutável de Prioridade Máxima
CREATE TABLE public.empresa_prioridade_maxima (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motivo text NOT NULL,
  observacoes text,
  criado_por_user_id uuid NOT NULL,
  criado_por_nome text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  removido_por_user_id uuid,
  removido_por_nome text,
  removido_em timestamptz,
  motivo_remocao text,
  ativo boolean GENERATED ALWAYS AS (removido_em IS NULL) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_empresa_prioridade_empresa ON public.empresa_prioridade_maxima(empresa_id);
CREATE INDEX idx_empresa_prioridade_ativo ON public.empresa_prioridade_maxima(empresa_id) WHERE removido_em IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.empresa_prioridade_maxima TO authenticated;
GRANT ALL ON public.empresa_prioridade_maxima TO service_role;

ALTER TABLE public.empresa_prioridade_maxima ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver prioridade"
  ON public.empresa_prioridade_maxima FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin e Diretora podem criar prioridade"
  ON public.empresa_prioridade_maxima FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Admin e Diretora podem atualizar prioridade"
  ON public.empresa_prioridade_maxima FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretora'::app_role));

CREATE TRIGGER trg_prioridade_updated_at
  BEFORE UPDATE ON public.empresa_prioridade_maxima
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna cache em empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS prioridade_maxima_id uuid REFERENCES public.empresa_prioridade_maxima(id);

CREATE INDEX IF NOT EXISTS idx_empresas_prioridade ON public.empresas(prioridade_maxima_id) WHERE prioridade_maxima_id IS NOT NULL;

-- RPC: marcar prioridade
CREATE OR REPLACE FUNCTION public.marcar_prioridade_maxima(
  p_empresa_id uuid,
  p_motivo text,
  p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_id uuid;
  v_existente uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'diretora'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Admin ou Diretora podem marcar Prioridade Máxima';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo é obrigatório';
  END IF;

  SELECT prioridade_maxima_id INTO v_existente FROM public.empresas WHERE id = p_empresa_id;
  IF v_existente IS NOT NULL THEN
    RETURN v_existente;
  END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.empresa_prioridade_maxima
    (empresa_id, motivo, observacoes, criado_por_user_id, criado_por_nome)
  VALUES (p_empresa_id, trim(p_motivo), NULLIF(trim(coalesce(p_observacoes,'')),''), v_uid, v_nome)
  RETURNING id INTO v_id;

  UPDATE public.empresas SET prioridade_maxima_id = v_id, updated_at = now() WHERE id = p_empresa_id;
  RETURN v_id;
END $$;

-- RPC: remover prioridade
CREATE OR REPLACE FUNCTION public.remover_prioridade_maxima(
  p_empresa_id uuid,
  p_motivo_remocao text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'diretora'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Admin ou Diretora podem remover Prioridade Máxima';
  END IF;

  SELECT prioridade_maxima_id INTO v_id FROM public.empresas WHERE id = p_empresa_id;
  IF v_id IS NULL THEN RETURN; END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.empresa_prioridade_maxima
     SET removido_em = now(),
         removido_por_user_id = v_uid,
         removido_por_nome = v_nome,
         motivo_remocao = NULLIF(trim(coalesce(p_motivo_remocao,'')),''),
         updated_at = now()
   WHERE id = v_id;

  UPDATE public.empresas SET prioridade_maxima_id = NULL, updated_at = now() WHERE id = p_empresa_id;
END $$;

GRANT EXECUTE ON FUNCTION public.marcar_prioridade_maxima(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_prioridade_maxima(uuid, text) TO authenticated;
