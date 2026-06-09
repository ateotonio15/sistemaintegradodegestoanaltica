
-- Permitir que usuários do perfil Financeiro também gerenciem grupos financeiros
DROP POLICY IF EXISTS "Admins manage grupos_financeiros" ON public.grupos_financeiros;
CREATE POLICY "Admins/Financeiro manage grupos_financeiros"
ON public.grupos_financeiros FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

DROP POLICY IF EXISTS "Admins manage gfc" ON public.grupos_financeiros_contratos;
CREATE POLICY "Admins/Financeiro manage gfc"
ON public.grupos_financeiros_contratos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role));

CREATE OR REPLACE FUNCTION public.adicionar_contrato_grupo(p_grupo_id uuid, p_empresa_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_empresa record;
  v_id uuid;
  v_existing record;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Apenas admins ou financeiro podem gerenciar grupos financeiros';
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
END $function$;

CREATE OR REPLACE FUNCTION public.remover_contrato_grupo(p_vinculo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_user_nome text;
  v_rec record;
BEGIN
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'financeiro'::app_role)) THEN
    RAISE EXCEPTION 'Apenas admins ou financeiro podem gerenciar grupos financeiros';
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
END $function$;
