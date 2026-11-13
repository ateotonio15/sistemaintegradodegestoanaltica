CREATE TABLE public.empresa_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  codigo_contrato text,
  usuario_id uuid,
  usuario_nome text,
  usuario_perfil text,
  categoria text NOT NULL,
  origem text NOT NULL,
  acao text NOT NULL,
  alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX empresa_historico_empresa_idx ON public.empresa_historico (empresa_id, created_at DESC);
COMMENT ON TABLE public.empresa_historico IS 'Trilha de auditoria append-only do contrato; escrita somente por triggers.';

GRANT SELECT ON public.empresa_historico TO authenticated;
GRANT ALL ON public.empresa_historico TO service_role;
ALTER TABLE public.empresa_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver historico de contratos visiveis" ON public.empresa_historico
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_historico.empresa_id));

CREATE OR REPLACE FUNCTION public.empresa_historico_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'O histórico do contrato não pode ser alterado nem excluído';
END $$;
CREATE TRIGGER trg_empresa_historico_imutavel BEFORE UPDATE OR DELETE ON public.empresa_historico
  FOR EACH ROW EXECUTE FUNCTION public.empresa_historico_imutavel();

CREATE OR REPLACE FUNCTION public._historico_usuario(OUT uid uuid, OUT nome text, OUT perfil text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN nome := 'Automação do SIGA'; perfil := 'sistema'; RETURN; END IF;
  SELECT COALESCE(p.display_name, p.username) INTO nome FROM public.profiles p WHERE p.user_id = uid LIMIT 1;
  SELECT string_agg(r.role::text, ', ' ORDER BY r.role::text) INTO perfil FROM public.user_roles r WHERE r.user_id = uid;
END $$;
REVOKE EXECUTE ON FUNCTION public._historico_usuario() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public._historico_nome_usuario(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(display_name, username) FROM public.profiles WHERE user_id = _id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.empresa_registrar_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  campos text[][] := ARRAY[
    ['nome','Nome','Cadastro'],['razao_social','Razão Social','Cadastro'],['nome_fantasia','Nome Fantasia','Cadastro'],
    ['cnpj','CNPJ','Cadastro'],['codigo_contrato','Código do Contrato','Cadastro'],
    ['responsavel_contrato','Responsável pelo Contrato','Cadastro'],['responsavel_user_id','Responsável (usuário)','Cadastro'],
    ['executiva_user_id','Executiva Responsável','Cadastro'],['email_empresa','E-mail da empresa','Cadastro'],
    ['telefone_empresa','Telefone','Cadastro'],['contato_empresa','Contato','Cadastro'],['enderecos','Endereços','Cadastro'],
    ['classificacao','Classificação','Produto/Plano'],
    ['data_implantacao','Data de Implantação','Contrato'],['data_vencimento_fatura','Vencimento','Financeiro'],
    ['vencimento_competencia','Competência do vencimento','Financeiro'],['data_emissao_fatura','Dia de emissão','Financeiro'],
    ['operadora_plano','Corretora','Contrato'],['tipo_contrato','Tipo de Contrato','Contrato'],
    ['tipo_movimentacao','Tipo de Movimentação','Movimentação'],['periodo_movimentacao','Período de Movimentação','Movimentação'],
    ['data_corte','Data de Corte','Movimentação'],['dia_movimentacao','Dia de movimentação','Movimentação'],
    ['plano','Plano','Produto/Plano'],['produto_enfermaria_codigo','Plano Enfermaria','Produto/Plano'],
    ['produto_apartamento_codigo','Plano Apartamento','Produto/Plano'],['produto_nao_definido_codigo','Plano (não definido)','Produto/Plano'],
    ['valor_enfermaria_centavos','Valor Enfermaria','Valores'],['valor_apartamento_centavos','Valor Apartamento','Valores'],
    ['contrato_faixa_etaria','Contrato por Faixa Etária','Valores'],['faixas_etarias','Valores das faixas etárias','Valores'],
    ['status_empresa','Status','Contrato'],['data_rescisao','Data de rescisão','Contrato'],
    ['pagamento_via_deposito','Pagamento via depósito','Financeiro'],['contrato_via_portal','Contrato pelo Portal','Contrato'],
    ['prazo','Prazo','Contrato'],['grupo_contrato','Grupo do Contrato','Contrato'],
    ['tipo_financeiro','Tipo Financeiro','Financeiro'],['email_financeiro_cliente','E-mail financeiro','Financeiro'],
    ['exige_po_pc','PO/PC','Financeiro'],['tem_coparticipacao','Coparticipação','Financeiro'],
    ['periodo_especifico_cobranca','Período de cobrança específico','Financeiro'],['periodo_cobranca_inicio','Início do período de cobrança','Financeiro'],
    ['nao_reajustado','Não reajustado','Reajuste'],['isento_reajuste','Isento de reajuste','Reajuste'],
    ['nao_faturado_financeiro','Não faturado','Financeiro'],['envio_boleto_com_nota','Boleto junto com a nota','Financeiro'],
    ['exige_relatorio_antes_nota','Relatório antes da nota','Financeiro'],['observacao_padrao_financeiro','Observação financeira','Financeiro'],
    ['regra_prorrogacao','Regra de prorrogação','Financeiro'],
    ['contrato_suspenso','Contrato suspenso','Suspensão'],['data_suspensao','Data de suspensão','Suspensão'],
    ['motivo_suspensao','Motivo da suspensão','Suspensão'],['observacoes','Observações','Cadastro']
  ];
  o jsonb := to_jsonb(OLD); n jsonb := to_jsonb(NEW);
  alts jsonb := '[]'::jsonb; cats text[] := '{}'; i int; c text; va jsonb; vn jsonb;
  u record; acao text; categoria text; origem text; motivo text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO u FROM public._historico_usuario();
    INSERT INTO public.empresa_historico(empresa_id,codigo_contrato,usuario_id,usuario_nome,usuario_perfil,categoria,origem,acao,alteracoes)
    VALUES (NEW.id, NEW.codigo_contrato, u.uid, u.nome, u.perfil, 'Cadastro',
      COALESCE(NULLIF(current_setting('siga.origem', true),''), CASE WHEN u.uid IS NULL THEN 'Automação do SIGA' ELSE 'Cadastro de Empresa' END),
      'Contrato cadastrado', '[]'::jsonb);
    RETURN NEW;
  END IF;
  FOR i IN 1..array_length(campos,1) LOOP
    c := campos[i][1]; va := o->c; vn := n->c;
    IF va IS DISTINCT FROM vn AND NOT (COALESCE(va,'null'::jsonb) IN ('null'::jsonb,'""'::jsonb) AND COALESCE(vn,'null'::jsonb) IN ('null'::jsonb,'""'::jsonb)) THEN
      IF c IN ('responsavel_user_id','executiva_user_id') THEN
        va := to_jsonb(public._historico_nome_usuario((o->>c)::uuid));
        vn := to_jsonb(public._historico_nome_usuario((n->>c)::uuid));
      END IF;
      alts := alts || jsonb_build_object('campo', c, 'rotulo', campos[i][2], 'categoria', campos[i][3], 'valor_anterior', va, 'valor_novo', vn);
      IF NOT campos[i][3] = ANY(cats) THEN cats := cats || campos[i][3]; END IF;
    END IF;
  END LOOP;
  IF jsonb_array_length(alts) = 0 THEN RETURN NEW; END IF;

  SELECT * INTO u FROM public._historico_usuario();
  origem := NULLIF(current_setting('siga.origem', true),'');
  IF COALESCE(OLD.contrato_suspenso,false) = false AND NEW.contrato_suspenso = true THEN
    acao := 'Contrato suspenso'; categoria := 'Suspensão'; origem := COALESCE(origem,'Suspensão de Contrato'); motivo := NEW.motivo_suspensao;
  ELSIF OLD.contrato_suspenso = true AND COALESCE(NEW.contrato_suspenso,false) = false THEN
    acao := 'Contrato reativado'; categoria := 'Suspensão'; origem := COALESCE(origem,'Reativação');
  ELSIF jsonb_array_length(alts) = 1 THEN
    acao := (alts->0->>'rotulo') || ' alterado'; categoria := cats[1];
  ELSE
    acao := 'Alteração cadastral'; categoria := CASE WHEN array_length(cats,1) = 1 THEN cats[1] ELSE 'Cadastro' END;
  END IF;
  origem := COALESCE(origem, CASE WHEN u.uid IS NULL THEN 'Automação do SIGA' ELSE 'Editar Empresa' END);

  INSERT INTO public.empresa_historico(empresa_id,codigo_contrato,usuario_id,usuario_nome,usuario_perfil,categoria,origem,acao,alteracoes,motivo)
  VALUES (NEW.id, NEW.codigo_contrato, u.uid, u.nome, u.perfil, categoria, origem, acao, alts, motivo);
  RETURN NEW;
END $$;

CREATE TRIGGER zz_empresa_historico AFTER INSERT OR UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.empresa_registrar_historico();

CREATE OR REPLACE FUNCTION public.grupo_contrato_registrar_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; g text; acao text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.ativo IS NOT DISTINCT FROM NEW.ativo THEN RETURN NEW; END IF;
  SELECT nome_grupo INTO g FROM public.grupos_financeiros WHERE id = NEW.grupo_id;
  acao := CASE WHEN NEW.ativo THEN 'Incluído no Grupo Financeiro' ELSE 'Removido do Grupo Financeiro' END;
  SELECT * INTO u FROM public._historico_usuario();
  INSERT INTO public.empresa_historico(empresa_id,codigo_contrato,usuario_id,usuario_nome,usuario_perfil,categoria,origem,acao,alteracoes)
  VALUES (NEW.empresa_id, NEW.codigo_contrato, u.uid, u.nome, u.perfil, 'Financeiro', 'Grupo Financeiro', acao,
    jsonb_build_array(jsonb_build_object('campo','grupo_financeiro','rotulo','Grupo Financeiro','categoria','Financeiro',
      'valor_anterior', CASE WHEN NEW.ativo THEN NULL ELSE to_jsonb(g) END,
      'valor_novo', CASE WHEN NEW.ativo THEN to_jsonb(g) ELSE NULL END)));
  RETURN NEW;
END $$;
CREATE TRIGGER zz_grupo_contrato_historico AFTER INSERT OR UPDATE ON public.grupos_financeiros_contratos
  FOR EACH ROW EXECUTE FUNCTION public.grupo_contrato_registrar_historico();

CREATE OR REPLACE FUNCTION public.reajuste_registrar_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u record; cod text;
BEGIN
  SELECT codigo_contrato INTO cod FROM public.empresas WHERE id = NEW.empresa_id;
  SELECT * INTO u FROM public._historico_usuario();
  INSERT INTO public.empresa_historico(empresa_id,codigo_contrato,usuario_id,usuario_nome,usuario_perfil,categoria,origem,acao,alteracoes)
  VALUES (NEW.empresa_id, cod, u.uid, u.nome, u.perfil, 'Reajuste', 'Reajustes', 'Reajuste aplicado',
    jsonb_build_array(
      jsonb_build_object('campo','competencia','rotulo','Competência','categoria','Reajuste','valor_anterior',NULL,'valor_novo',to_jsonb(NEW.competencia)),
      jsonb_build_object('campo','valor_reajuste_centavos','rotulo','Valor do reajuste','categoria','Reajuste','valor_anterior',NULL,'valor_novo',to_jsonb(NEW.valor_centavos))));
  RETURN NEW;
END $$;
CREATE TRIGGER zz_reajuste_historico AFTER INSERT ON public.reajustes
  FOR EACH ROW EXECUTE FUNCTION public.reajuste_registrar_historico();