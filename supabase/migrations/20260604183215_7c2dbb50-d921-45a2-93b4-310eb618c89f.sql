
-- ============== TABELAS ==============
CREATE TABLE public.grupos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_grupo text NOT NULL UNIQUE,
  vencimento_compartilhado boolean NOT NULL DEFAULT false,
  dia_vencimento smallint CHECK (dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31)),
  forma_pagamento_compartilhada boolean NOT NULL DEFAULT false,
  forma_pagamento text CHECK (forma_pagamento IS NULL OR forma_pagamento IN ('DDA','Depósito')),
  observacao text,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Inativo')),
  criado_por_id uuid,
  criado_por_nome text,
  atualizado_por_id uuid,
  atualizado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_financeiros TO authenticated;
GRANT ALL ON public.grupos_financeiros TO service_role;
ALTER TABLE public.grupos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal roles read grupos_financeiros"
  ON public.grupos_financeiros FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'comum'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
    OR has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
    OR has_role(auth.uid(),'executivo'::app_role) OR has_role(auth.uid(),'vendas'::app_role)
  );
CREATE POLICY "Admins manage grupos_financeiros"
  ON public.grupos_financeiros FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_grupos_financeiros_updated_at
  BEFORE UPDATE ON public.grupos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- contratos vinculados
CREATE TABLE public.grupos_financeiros_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_financeiros(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo_contrato text,
  nome_empresa text,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  adicionado_por_id uuid,
  adicionado_por_nome text,
  adicionado_em timestamptz NOT NULL DEFAULT now(),
  removido_por_id uuid,
  removido_por_nome text,
  removido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_empresa_grupo_ativo
  ON public.grupos_financeiros_contratos(empresa_id) WHERE ativo = true;
CREATE INDEX idx_gfc_grupo ON public.grupos_financeiros_contratos(grupo_id) WHERE ativo = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_financeiros_contratos TO authenticated;
GRANT ALL ON public.grupos_financeiros_contratos TO service_role;
ALTER TABLE public.grupos_financeiros_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal roles read gfc"
  ON public.grupos_financeiros_contratos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'comum'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
    OR has_role(auth.uid(),'visualizacao'::app_role) OR has_role(auth.uid(),'diretora'::app_role)
    OR has_role(auth.uid(),'executivo'::app_role) OR has_role(auth.uid(),'vendas'::app_role)
  );
CREATE POLICY "Admins manage gfc"
  ON public.grupos_financeiros_contratos FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_gfc_updated_at BEFORE UPDATE ON public.grupos_financeiros_contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auditoria
CREATE TABLE public.grupos_financeiros_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES public.grupos_financeiros(id) ON DELETE SET NULL,
  acao text NOT NULL,
  descricao text,
  contrato_origem_id uuid,
  contratos_impactados uuid[],
  usuario_id uuid,
  usuario_nome text,
  data_hora timestamptz NOT NULL DEFAULT now(),
  dados_anteriores jsonb,
  dados_novos jsonb
);
GRANT SELECT, INSERT ON public.grupos_financeiros_auditoria TO authenticated;
GRANT ALL ON public.grupos_financeiros_auditoria TO service_role;
ALTER TABLE public.grupos_financeiros_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal roles read gfa"
  ON public.grupos_financeiros_auditoria FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'financeiro'::app_role)
    OR has_role(auth.uid(),'comum'::app_role) OR has_role(auth.uid(),'administradoras'::app_role)
    OR has_role(auth.uid(),'diretora'::app_role)
  );
CREATE POLICY "Authenticated insert gfa"
  ON public.grupos_financeiros_auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- ============== ANEXOS FINANCEIRO: campos de compartilhamento ==============
ALTER TABLE public.anexos_financeiro
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.grupos_financeiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compartilhado_grupo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contrato_origem_id uuid;
CREATE INDEX IF NOT EXISTS idx_anexos_financeiro_grupo ON public.anexos_financeiro(grupo_id) WHERE grupo_id IS NOT NULL;

-- ============== RPCs ==============

-- adicionar contrato ao grupo
CREATE OR REPLACE FUNCTION public.adicionar_contrato_grupo(p_grupo_id uuid, p_empresa_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_empresa record;
  v_id uuid;
  v_existing record;
BEGIN
  IF NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem gerenciar grupos financeiros';
  END IF;

  SELECT nome, cnpj, codigo_contrato INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa não encontrada'; END IF;

  SELECT gfc.*, gf.nome_grupo INTO v_existing
  FROM public.grupos_financeiros_contratos gfc
  JOIN public.grupos_financeiros gf ON gf.id = gfc.grupo_id
  WHERE gfc.empresa_id = p_empresa_id AND gfc.ativo = true
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.grupo_id = p_grupo_id THEN
      RETURN v_existing.id;
    END IF;
    RAISE EXCEPTION 'Este contrato já pertence ao grupo "%". Cada contrato só pode participar de um grupo ativo.', v_existing.nome_grupo;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.grupos_financeiros_contratos
    (grupo_id, empresa_id, codigo_contrato, nome_empresa, cnpj, adicionado_por_id, adicionado_por_nome)
  VALUES
    (p_grupo_id, p_empresa_id, v_empresa.codigo_contrato, v_empresa.nome, v_empresa.cnpj, v_uid, v_user_nome)
  RETURNING id INTO v_id;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (p_grupo_id, 'contrato_adicionado', 'Contrato adicionado ao grupo', p_empresa_id, ARRAY[p_empresa_id], v_uid, v_user_nome,
     jsonb_build_object('empresa_id', p_empresa_id, 'nome', v_empresa.nome));

  RETURN v_id;
END $$;

-- remover contrato do grupo
CREATE OR REPLACE FUNCTION public.remover_contrato_grupo(p_vinculo_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_rec record;
BEGIN
  IF NOT public.has_role(v_uid,'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas admins podem gerenciar grupos financeiros';
  END IF;
  SELECT * INTO v_rec FROM public.grupos_financeiros_contratos WHERE id = p_vinculo_id;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'Vínculo não encontrado'; END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  UPDATE public.grupos_financeiros_contratos
     SET ativo = false, removido_por_id = v_uid, removido_por_nome = v_user_nome, removido_em = now()
   WHERE id = p_vinculo_id;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_anteriores)
  VALUES
    (v_rec.grupo_id, 'contrato_removido', 'Contrato removido do grupo', v_rec.empresa_id, ARRAY[v_rec.empresa_id], v_uid, v_user_nome,
     to_jsonb(v_rec));
END $$;

-- aplicar envio de nota a todos do grupo
CREATE OR REPLACE FUNCTION public.aplicar_envio_nota_grupo(p_mov_id uuid, p_data_envio date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET data_envio_nota = p_data_envio, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;

  -- garante registros e atualiza
  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true
    FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_movimentacoes fm2
        WHERE fm2.empresa_id = gfc.empresa_id
          AND fm2.mes_referencia = v_mov.mes_referencia
          AND fm2.periodo = v_mov.periodo
     );

  UPDATE public.financeiro_movimentacoes fm
     SET data_envio_nota = p_data_envio, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'envio_nota_grupo', 'Envio de nota aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('data_envio', p_data_envio, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $$;

-- aplicar DDA/depósito a todos do grupo
CREATE OR REPLACE FUNCTION public.aplicar_dda_grupo(p_mov_id uuid, p_boleto_dda boolean, p_pagamento_deposito boolean)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes
       SET boleto_dda = p_boleto_dda, updated_at = now()
     WHERE id = p_mov_id;
    UPDATE public.empresas SET pagamento_via_deposito = p_pagamento_deposito WHERE id = v_mov.empresa_id;
    RETURN 1;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;

  UPDATE public.financeiro_movimentacoes fm
     SET boleto_dda = p_boleto_dda, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.empresas SET pagamento_via_deposito = p_pagamento_deposito
   WHERE id = ANY(v_impactados);

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'dda_grupo', 'DDA/Depósito aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('boleto_dda', p_boleto_dda, 'pagamento_via_deposito', p_pagamento_deposito));
  RETURN v_count;
END $$;

-- aplicar vencimento a todos do grupo
CREATE OR REPLACE FUNCTION public.aplicar_vencimento_grupo(p_mov_id uuid, p_data_vencimento date)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_mov record;
  v_grupo_id uuid;
  v_count int := 0;
  v_impactados uuid[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT fm.* INTO v_mov FROM public.financeiro_movimentacoes fm WHERE fm.id = p_mov_id;
  IF v_mov IS NULL THEN RAISE EXCEPTION 'Movimentação não encontrada'; END IF;

  SELECT grupo_id INTO v_grupo_id
  FROM public.grupos_financeiros_contratos
  WHERE empresa_id = v_mov.empresa_id AND ativo = true LIMIT 1;

  IF v_grupo_id IS NULL THEN
    UPDATE public.financeiro_movimentacoes SET data_vencimento = p_data_vencimento, updated_at = now() WHERE id = p_mov_id;
    RETURN 1;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;
  SELECT array_agg(empresa_id) INTO v_impactados FROM public.grupos_financeiros_contratos WHERE grupo_id = v_grupo_id AND ativo = true;

  INSERT INTO public.financeiro_movimentacoes (empresa_id, mes_referencia, periodo, dentro_prazo)
  SELECT gfc.empresa_id, v_mov.mes_referencia, v_mov.periodo, true
    FROM public.grupos_financeiros_contratos gfc
   WHERE gfc.grupo_id = v_grupo_id AND gfc.ativo = true
     AND NOT EXISTS (
       SELECT 1 FROM public.financeiro_movimentacoes fm2
        WHERE fm2.empresa_id = gfc.empresa_id
          AND fm2.mes_referencia = v_mov.mes_referencia
          AND fm2.periodo = v_mov.periodo
     );

  UPDATE public.financeiro_movimentacoes fm
     SET data_vencimento = p_data_vencimento, updated_at = now()
   WHERE fm.mes_referencia = v_mov.mes_referencia
     AND fm.periodo = v_mov.periodo
     AND fm.empresa_id = ANY(v_impactados);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.grupos_financeiros_auditoria
    (grupo_id, acao, descricao, contrato_origem_id, contratos_impactados, usuario_id, usuario_nome, dados_novos)
  VALUES
    (v_grupo_id, 'vencimento_grupo', 'Vencimento aplicado ao grupo', v_mov.empresa_id, v_impactados, v_uid, v_user_nome,
     jsonb_build_object('data_vencimento', p_data_vencimento, 'mes_referencia', v_mov.mes_referencia, 'periodo', v_mov.periodo));
  RETURN v_count;
END $$;
