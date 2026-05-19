
-- 1) Novos campos de workflow
ALTER TABLE public.implantacoes_contratos
  ADD COLUMN IF NOT EXISTS progresso smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enviado_diretoria_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviado_diretoria_por uuid,
  ADD COLUMN IF NOT EXISTS enviado_diretoria_por_nome text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome text,
  ADD COLUMN IF NOT EXISTS observacao_diretoria text,
  ADD COLUMN IF NOT EXISTS motivo_correcao text,
  ADD COLUMN IF NOT EXISTS enviado_cadastro_em timestamptz,
  ADD COLUMN IF NOT EXISTS implantado_em timestamptz,
  ADD COLUMN IF NOT EXISTS implantado_por uuid,
  ADD COLUMN IF NOT EXISTS implantado_por_nome text;

-- 2) RLS Vendas em implantações
DROP POLICY IF EXISTS "Vendas manage own implantacoes" ON public.implantacoes_contratos;
CREATE POLICY "Vendas manage own implantacoes"
ON public.implantacoes_contratos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'vendas'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Vendas read implantacoes" ON public.implantacoes_contratos;
CREATE POLICY "Vendas read implantacoes"
ON public.implantacoes_contratos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'vendas'::app_role));

-- 3) Diretora ler implantações
DROP POLICY IF EXISTS "Diretora read implantacoes" ON public.implantacoes_contratos;
CREATE POLICY "Diretora read implantacoes"
ON public.implantacoes_contratos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

-- 4) Anexos da implantação - vendas
DROP POLICY IF EXISTS "Vendas manage impl anexos" ON public.implantacao_anexos;
CREATE POLICY "Vendas manage impl anexos"
ON public.implantacao_anexos
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'vendas'::app_role)
  AND EXISTS (SELECT 1 FROM public.implantacoes_contratos ic WHERE ic.id = implantacao_id AND ic.created_by = auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'vendas'::app_role)
  AND EXISTS (SELECT 1 FROM public.implantacoes_contratos ic WHERE ic.id = implantacao_id AND ic.created_by = auth.uid())
);

DROP POLICY IF EXISTS "Diretora read impl anexos" ON public.implantacao_anexos;
CREATE POLICY "Diretora read impl anexos"
ON public.implantacao_anexos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

-- 5) Logs - vendas/diretora podem inserir
DROP POLICY IF EXISTS "Workflow insert impl logs" ON public.implantacao_logs;
CREATE POLICY "Workflow insert impl logs"
ON public.implantacao_logs
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'vendas'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
);

-- 6) Tabela de alertas
CREATE TABLE IF NOT EXISTS public.implantacao_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implantacao_id uuid NOT NULL,
  tipo text NOT NULL,
  destinatario_role text NOT NULL,
  destinatario_user_id uuid,
  empresa_nome text,
  mensagem text,
  status text NOT NULL DEFAULT 'Pendente',
  criado_por uuid,
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.implantacao_alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Admin manage impl alertas"
ON public.implantacao_alertas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Diretora manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Diretora manage impl alertas"
ON public.implantacao_alertas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role) AND destinatario_role = 'diretora')
WITH CHECK (public.has_role(auth.uid(), 'diretora'::app_role));

DROP POLICY IF EXISTS "Cadastro manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Cadastro manage impl alertas"
ON public.implantacao_alertas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'comum'::app_role) AND destinatario_role = 'comum')
WITH CHECK (public.has_role(auth.uid(), 'comum'::app_role));

DROP POLICY IF EXISTS "Vendas manage impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Vendas manage impl alertas"
ON public.implantacao_alertas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'vendas'::app_role) AND (destinatario_role = 'vendas' OR criado_por = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'vendas'::app_role));

DROP POLICY IF EXISTS "Auth read impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Auth read impl alertas"
ON public.implantacao_alertas FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_impl_alertas_destino ON public.implantacao_alertas(destinatario_role, status);
CREATE INDEX IF NOT EXISTS idx_impl_alertas_impl ON public.implantacao_alertas(implantacao_id);

DROP TRIGGER IF EXISTS trg_impl_alertas_updated_at ON public.implantacao_alertas;
CREATE TRIGGER trg_impl_alertas_updated_at
BEFORE UPDATE ON public.implantacao_alertas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Helper log
CREATE OR REPLACE FUNCTION public._log_impl(_impl uuid, _acao text, _detalhes jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text;
BEGIN
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.implantacao_logs(implantacao_id, acao, detalhes, user_id, user_nome)
  VALUES (_impl, _acao, _detalhes, auth.uid(), v_nome);
END $$;

-- 8) Enviar para diretoria
CREATE OR REPLACE FUNCTION public.enviar_implantacao_diretoria(p_impl uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text; v_has boolean; v_alerta uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'vendas'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Vendas pode enviar para Diretoria';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  IF v_impl.created_by IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Sem permissão para esta implantação';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.implantacao_anexos WHERE implantacao_id = p_impl AND tipo = 'anexo1') INTO v_has;
  IF NOT v_has THEN RAISE EXCEPTION 'Anexe ao menos o Anexo I antes de enviar para a Diretoria'; END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'em_analise_diretoria',
         progresso = GREATEST(progresso, 45),
         enviado_diretoria_em = now(),
         enviado_diretoria_por = v_uid,
         enviado_diretoria_por_nome = v_nome,
         motivo_correcao = NULL,
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'enviado_diretoria', jsonb_build_object('por', v_nome));

  INSERT INTO public.implantacao_alertas
    (implantacao_id, tipo, destinatario_role, empresa_nome, mensagem, criado_por, criado_por_nome)
  VALUES
    (p_impl, 'envio_diretoria', 'diretora', v_impl.nome_empresa,
     'Novo contrato aguardando análise da Diretoria', v_uid, v_nome)
  RETURNING id INTO v_alerta;
  RETURN v_alerta;
END $$;

-- 9) Aprovar
CREATE OR REPLACE FUNCTION public.aprovar_implantacao(p_impl uuid, p_observacao text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text; v_alerta uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas a Diretora pode aprovar';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'aprovado_diretoria',
         progresso = GREATEST(progresso, 75),
         aprovado_em = now(), aprovado_por = v_uid, aprovado_por_nome = v_nome,
         observacao_diretoria = COALESCE(p_observacao, observacao_diretoria),
         enviado_cadastro_em = now(),
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'aprovado_diretoria', jsonb_build_object('por', v_nome, 'observacao', p_observacao));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'diretora' AND status = 'Pendente';

  INSERT INTO public.implantacao_alertas
    (implantacao_id, tipo, destinatario_role, empresa_nome, mensagem, criado_por, criado_por_nome)
  VALUES
    (p_impl, 'aprovado', 'comum', v_impl.nome_empresa,
     'Contrato aprovado pela Diretoria. Pronto para implantação final.', v_uid, v_nome)
  RETURNING id INTO v_alerta;
  RETURN v_alerta;
END $$;

-- 10) Solicitar correção
CREATE OR REPLACE FUNCTION public.solicitar_correcao_implantacao(p_impl uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text; v_alerta uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas a Diretora pode solicitar correção';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'necessita_correcao',
         progresso = LEAST(progresso, 35),
         motivo_correcao = p_motivo, updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'correcao_solicitada', jsonb_build_object('por', v_nome, 'motivo', p_motivo));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'diretora' AND status = 'Pendente';

  INSERT INTO public.implantacao_alertas
    (implantacao_id, tipo, destinatario_role, destinatario_user_id, empresa_nome, mensagem, criado_por, criado_por_nome)
  VALUES
    (p_impl, 'correcao', 'vendas', v_impl.created_by, v_impl.nome_empresa,
     'Correção solicitada pela Diretoria: ' || p_motivo, v_uid, v_nome)
  RETURNING id INTO v_alerta;
  RETURN v_alerta;
END $$;

-- 11) Rejeitar
CREATE OR REPLACE FUNCTION public.rejeitar_implantacao(p_impl uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text; v_alerta uuid;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas a Diretora pode rejeitar';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN RAISE EXCEPTION 'Informe o motivo'; END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'rejeitado', motivo_correcao = p_motivo, updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'rejeitado', jsonb_build_object('por', v_nome, 'motivo', p_motivo));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'diretora' AND status = 'Pendente';

  INSERT INTO public.implantacao_alertas
    (implantacao_id, tipo, destinatario_role, destinatario_user_id, empresa_nome, mensagem, criado_por, criado_por_nome)
  VALUES
    (p_impl, 'rejeitado', 'vendas', v_impl.created_by, v_impl.nome_empresa,
     'Implantação rejeitada pela Diretoria: ' || p_motivo, v_uid, v_nome)
  RETURNING id INTO v_alerta;
  RETURN v_alerta;
END $$;

-- 12) Finalizar (Cadastro)
CREATE OR REPLACE FUNCTION public.finalizar_implantacao_cadastro(p_impl uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_impl record; v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode finalizar';
  END IF;
  SELECT * INTO v_impl FROM public.implantacoes_contratos WHERE id = p_impl;
  IF v_impl.id IS NULL THEN RAISE EXCEPTION 'Implantação não encontrada'; END IF;
  IF v_impl.status NOT IN ('aprovado_diretoria','enviado_cadastro') THEN
    RAISE EXCEPTION 'Implantação ainda não foi aprovada pela Diretoria';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.implantacoes_contratos
     SET status = 'implantado', progresso = 100,
         implantado_em = now(), implantado_por = v_uid, implantado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_impl;

  PERFORM public._log_impl(p_impl, 'implantado', jsonb_build_object('por', v_nome));

  UPDATE public.implantacao_alertas
     SET status = 'Finalizado', finalizado_em = now(), updated_at = now()
   WHERE implantacao_id = p_impl AND destinatario_role = 'comum' AND status = 'Pendente';

  RETURN p_impl;
END $$;
