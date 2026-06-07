
-- 1. Novas colunas na reajustes_anuais
ALTER TABLE public.reajustes_anuais
  ADD COLUMN IF NOT EXISTS aprovado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS rejeitado_por_nome text,
  ADD COLUMN IF NOT EXISTS rejeitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS retroativo_aplicado_por_user_id uuid,
  ADD COLUMN IF NOT EXISTS retroativo_aplicado_por_nome text,
  ADD COLUMN IF NOT EXISTS retroativo_aplicado_em timestamptz;

-- 2. Novo destinatário por role no alerta
ALTER TABLE public.alertas_reajuste
  ADD COLUMN IF NOT EXISTS destinatario_role text,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'analise';

-- 3. Tabela histórico
CREATE TABLE IF NOT EXISTS public.reajustes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reajuste_id uuid NOT NULL REFERENCES public.reajustes_anuais(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  evento text NOT NULL,
  usuario_id uuid,
  usuario_nome text,
  observacao text,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reajustes_hist_reajuste ON public.reajustes_historico(reajuste_id);
CREATE INDEX IF NOT EXISTS idx_reajustes_hist_empresa ON public.reajustes_historico(empresa_id);

GRANT SELECT ON public.reajustes_historico TO authenticated;
GRANT ALL ON public.reajustes_historico TO service_role;

ALTER TABLE public.reajustes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hist reajuste leitura" ON public.reajustes_historico
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'diretora'::app_role)
    OR public.has_role(auth.uid(),'financeiro'::app_role)
    OR public.has_role(auth.uid(),'visualizacao'::app_role)
    OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = reajustes_historico.empresa_id AND e.responsavel_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = reajustes_historico.empresa_id AND eu.user_id = auth.uid())
  );

-- 4. Helper interno para registrar histórico
CREATE OR REPLACE FUNCTION public._log_reajuste(p_reajuste uuid, p_evento text, p_obs text DEFAULT NULL, p_dados jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text; v_emp uuid;
BEGIN
  SELECT empresa_id INTO v_emp FROM public.reajustes_anuais WHERE id = p_reajuste;
  IF v_emp IS NULL THEN RETURN; END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  INSERT INTO public.reajustes_historico (reajuste_id, empresa_id, evento, usuario_id, usuario_nome, observacao, dados)
  VALUES (p_reajuste, v_emp, p_evento, v_uid, v_nome, p_obs, p_dados);
END $$;

-- 5. Função auxiliar: criar alerta para uma role (busca primeiro usuário responsável)
CREATE OR REPLACE FUNCTION public._criar_alerta_reajuste_role(p_reajuste uuid, p_role text, p_tipo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r record; v_dest uuid; v_nome text; v_uid uuid := auth.uid();
BEGIN
  SELECT r.*, e.nome AS empresa_nome, e.responsavel_user_id
    INTO v_r
  FROM public.reajustes_anuais r JOIN public.empresas e ON e.id = r.empresa_id
  WHERE r.id = p_reajuste;
  IF v_r.id IS NULL THEN RETURN; END IF;

  IF p_role = 'comum' THEN
    v_dest := v_r.responsavel_user_id;
  END IF;

  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.alertas_reajuste
    (reajuste_id, empresa_id, empresa_nome, criado_por_user_id, criado_por_nome,
     destinatario_user_id, destinatario_role, tipo, status)
  VALUES
    (p_reajuste, v_r.empresa_id, v_r.empresa_nome, v_uid, v_nome,
     v_dest, p_role, p_tipo, 'Pendente');
END $$;

-- 6. RPC: Cadastro confirma → envia para Diretora
CREATE OR REPLACE FUNCTION public.confirmar_reajuste_cadastro(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'comum'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Cadastro pode confirmar';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'aguardando_aprovacao',
         confirmado_por = v_uid, confirmado_por_nome = v_nome, data_confirmacao = now(),
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role = 'comum' AND status='Pendente';
  PERFORM public._criar_alerta_reajuste_role(p_id, 'diretora', 'aprovacao');
  PERFORM public._log_reajuste(p_id, 'confirmado', NULL, NULL);
END $$;

-- 7. RPC: Diretora aprova
CREATE OR REPLACE FUNCTION public.aprovar_reajuste(p_id uuid, p_obs text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Diretora pode aprovar';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'aprovado',
         aprovado_por_user_id = v_uid, aprovado_por_nome = v_nome, aprovado_em = now(),
         rejeitado_por_user_id = NULL, rejeitado_por_nome = NULL, rejeitado_em = NULL, motivo_rejeicao = NULL,
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role='diretora' AND status='Pendente';
  PERFORM public._log_reajuste(p_id, 'aprovado', p_obs, NULL);
END $$;

-- 8. RPC: Diretora rejeita
CREATE OR REPLACE FUNCTION public.rejeitar_reajuste(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Diretora pode rejeitar';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo da rejeição é obrigatório';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'rejeitado',
         rejeitado_por_user_id = v_uid, rejeitado_por_nome = v_nome, rejeitado_em = now(),
         motivo_rejeicao = p_motivo,
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role='diretora' AND status='Pendente';
  PERFORM public._criar_alerta_reajuste_role(p_id, 'comum', 'correcao');
  PERFORM public._log_reajuste(p_id, 'rejeitado', p_motivo, NULL);
END $$;

-- 9. RPC: Diretora libera para Financeiro
CREATE OR REPLACE FUNCTION public.liberar_reajuste_financeiro(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text; v_retro bigint;
BEGIN
  IF NOT (public.has_role(v_uid,'diretora'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Diretora pode liberar para o Financeiro';
  END IF;
  SELECT COALESCE(valor_retroativo_centavos,0) INTO v_retro FROM public.reajustes_anuais WHERE id = p_id;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = CASE WHEN COALESCE(v_retro,0) > 0 THEN 'liberado_financeiro' ELSE 'reajustado' END,
         data_liberacao = now(), liberado_por = v_uid, liberado_por_nome = v_nome,
         updated_at = now()
   WHERE id = p_id;
  IF COALESCE(v_retro,0) > 0 THEN
    PERFORM public._criar_alerta_reajuste_role(p_id, 'financeiro', 'retroativo');
    PERFORM public._log_reajuste(p_id, 'liberado_financeiro', NULL, NULL);
  ELSE
    PERFORM public._log_reajuste(p_id, 'reajustado', NULL, NULL);
  END IF;
END $$;

-- 10. RPC: Financeiro aplica retroativo
CREATE OR REPLACE FUNCTION public.aplicar_retroativo_reajuste(p_id uuid, p_obs text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF NOT (public.has_role(v_uid,'financeiro'::app_role) OR public.has_role(v_uid,'admin'::app_role)) THEN
    RAISE EXCEPTION 'Apenas Financeiro pode aplicar o retroativo';
  END IF;
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
  UPDATE public.reajustes_anuais
     SET status_reajuste = 'retroativo_aplicado',
         retroativo_aplicado_por_user_id = v_uid,
         retroativo_aplicado_por_nome = v_nome,
         retroativo_aplicado_em = now(),
         updated_at = now()
   WHERE id = p_id;
  UPDATE public.alertas_reajuste SET status='Finalizado', finalizado_em=now(), updated_at=now()
   WHERE reajuste_id = p_id AND destinatario_role='financeiro' AND status='Pendente';
  PERFORM public._log_reajuste(p_id, 'retroativo_aplicado', p_obs, NULL);
END $$;

-- 11. Trigger: log automático em mudanças de solicitação/edição
CREATE OR REPLACE FUNCTION public.trg_log_reajuste_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_nome text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
    INSERT INTO public.reajustes_historico (reajuste_id, empresa_id, evento, usuario_id, usuario_nome, dados)
    VALUES (NEW.id, NEW.empresa_id, 'solicitado', v_uid, v_nome,
            jsonb_build_object('percentual', NEW.percentual, 'data_aplicacao', NEW.data_aplicacao));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_reajuste_change ON public.reajustes_anuais;
CREATE TRIGGER trg_log_reajuste_change
  AFTER INSERT ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_reajuste_change();
