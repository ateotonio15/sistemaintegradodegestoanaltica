
-- 1) Campos extras em avaliacoes_envios
ALTER TABLE public.avaliacoes_envios
  ADD COLUMN IF NOT EXISTS executiva_user_id uuid,
  ADD COLUMN IF NOT EXISTS executiva_nome text,
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS mes_referencia text,
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS resposta_id uuid;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_envios_mes ON public.avaliacoes_envios(mes_referencia);

-- 2) Link da resposta para o envio
ALTER TABLE public.cs_avaliacao_respostas
  ADD COLUMN IF NOT EXISTS envio_id uuid REFERENCES public.avaliacoes_envios(id) ON DELETE SET NULL;

-- 3) Permitir respostas anônimas (link público por token) - garantir policy
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='cs_avaliacao_respostas' AND policyname='Permitir resposta anonima') THEN
    EXECUTE 'CREATE POLICY "Permitir resposta anonima" ON public.cs_avaliacao_respostas FOR INSERT TO anon WITH CHECK (true)';
  END IF;
END $$;

GRANT INSERT ON public.cs_avaliacao_respostas TO anon;

-- 4) Tabela de configuração (single row)
CREATE TABLE IF NOT EXISTS public.avaliacoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envio_mensal_ativo boolean NOT NULL DEFAULT true,
  dia_envio smallint NOT NULL DEFAULT 1,
  dias_para_lembrete smallint NOT NULL DEFAULT 7,
  lembrete_ativo boolean NOT NULL DEFAULT true,
  formulario_id uuid REFERENCES public.cs_avaliacao_formularios(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.avaliacoes_config TO authenticated;
GRANT ALL ON public.avaliacoes_config TO service_role;

ALTER TABLE public.avaliacoes_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem config" ON public.avaliacoes_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/diretora/executivo alteram config" ON public.avaliacoes_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role) OR public.has_role(auth.uid(),'executivo'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'diretora'::app_role) OR public.has_role(auth.uid(),'executivo'::app_role));

INSERT INTO public.avaliacoes_config (envio_mensal_ativo, dia_envio, dias_para_lembrete, lembrete_ativo)
SELECT true, 1, 7, true
WHERE NOT EXISTS (SELECT 1 FROM public.avaliacoes_config);

-- 5) Função: processa envios mensais e lembretes
CREATE OR REPLACE FUNCTION public.processar_avaliacoes_envios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg record;
  v_form_id uuid;
  v_mes text := to_char(CURRENT_DATE, 'YYYY-MM');
  v_criados int := 0;
  v_lembretes int := 0;
  v_emp record;
BEGIN
  SELECT * INTO v_cfg FROM public.avaliacoes_config LIMIT 1;
  IF v_cfg IS NULL THEN RETURN jsonb_build_object('erro','sem config'); END IF;

  v_form_id := v_cfg.formulario_id;
  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id FROM public.cs_avaliacao_formularios WHERE tipo='rh' ORDER BY created_at DESC LIMIT 1;
  END IF;

  -- Envio mensal: cria 1 envio por empresa EMPRESARIAL ativa que ainda não tenha envio neste mês
  IF v_cfg.envio_mensal_ativo
     AND EXTRACT(DAY FROM CURRENT_DATE)::int >= v_cfg.dia_envio THEN
    FOR v_emp IN
      SELECT e.id, e.nome, e.email_empresa, e.responsavel_user_id, e.responsavel_contrato
        FROM public.empresas e
       WHERE e.status_empresa = 'Ativa'
         AND e.tipo_contrato = 'EMPRESARIAL'
         AND e.data_implantacao <= CURRENT_DATE
         AND e.data_rescisao IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.avaliacoes_envios ae
            WHERE ae.empresa_id = e.id AND ae.mes_referencia = v_mes
         )
    LOOP
      INSERT INTO public.avaliacoes_envios
        (empresa_id, empresa_nome, email_destino, status, formulario_id, mes_referencia,
         executiva_user_id, executiva_nome)
      VALUES
        (v_emp.id, v_emp.nome, COALESCE(v_emp.email_empresa,''), 'pendente_envio',
         v_form_id, v_mes, v_emp.responsavel_user_id, v_emp.responsavel_contrato);
      v_criados := v_criados + 1;
    END LOOP;
  END IF;

  -- Lembretes: envios com >= N dias sem resposta e sem lembrete ainda
  IF v_cfg.lembrete_ativo THEN
    UPDATE public.avaliacoes_envios
       SET status = 'lembrete', lembrete_enviado_em = now(), updated_at = now()
     WHERE data_resposta IS NULL
       AND lembrete_enviado_em IS NULL
       AND status IN ('enviado','pendente_envio')
       AND data_envio <= now() - (v_cfg.dias_para_lembrete || ' days')::interval;
    GET DIAGNOSTICS v_lembretes = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('mes', v_mes, 'envios_criados', v_criados, 'lembretes_marcados', v_lembretes);
END $$;

REVOKE EXECUTE ON FUNCTION public.processar_avaliacoes_envios() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_avaliacoes_envios() TO authenticated, service_role;

-- 6) Cron diário 08:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron;
DO $$ BEGIN
  PERFORM cron.unschedule('avaliacoes-envios-diario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('avaliacoes-envios-diario', '0 8 * * *', $cron$ SELECT public.processar_avaliacoes_envios(); $cron$);
