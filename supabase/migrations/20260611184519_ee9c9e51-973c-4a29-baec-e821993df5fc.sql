-- Permitir que perfil Comum (Cadastro) também marque/remova Prioridade Máxima
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretora') OR public.has_role(v_uid,'comum') OR public.has_role(v_uid,'administradoras')) THEN
    RAISE EXCEPTION 'Sem permissão para definir Prioridade Máxima';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo obrigatório';
  END IF;

  SELECT COALESCE(full_name, username) INTO v_nome FROM public.profiles WHERE id = v_uid;

  -- fechar marcação ativa anterior se existir
  UPDATE public.empresa_prioridade_maxima
     SET removido_em = now(),
         removido_por_user_id = v_uid,
         removido_por_nome = v_nome,
         motivo_remocao = COALESCE(motivo_remocao, 'Substituída por nova marcação')
   WHERE empresa_id = p_empresa_id AND removido_em IS NULL;

  INSERT INTO public.empresa_prioridade_maxima
    (empresa_id, motivo, observacoes, criado_por_user_id, criado_por_nome)
  VALUES (p_empresa_id, p_motivo, p_observacoes, v_uid, v_nome)
  RETURNING id INTO v_id;

  UPDATE public.empresas SET prioridade_maxima_id = v_id WHERE id = p_empresa_id;

  RETURN v_id;
END;
$$;

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_role(v_uid,'admin') OR public.has_role(v_uid,'diretora') OR public.has_role(v_uid,'comum') OR public.has_role(v_uid,'administradoras')) THEN
    RAISE EXCEPTION 'Sem permissão para remover Prioridade Máxima';
  END IF;

  SELECT COALESCE(full_name, username) INTO v_nome FROM public.profiles WHERE id = v_uid;

  UPDATE public.empresa_prioridade_maxima
     SET removido_em = now(),
         removido_por_user_id = v_uid,
         removido_por_nome = v_nome,
         motivo_remocao = p_motivo_remocao
   WHERE empresa_id = p_empresa_id AND removido_em IS NULL;

  UPDATE public.empresas SET prioridade_maxima_id = NULL WHERE id = p_empresa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_prioridade_maxima(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_prioridade_maxima(uuid,text) TO authenticated;

-- Atualizar RLS para incluir comum/administradoras
DROP POLICY IF EXISTS "prioridade_insert_admin_diretora" ON public.empresa_prioridade_maxima;
DROP POLICY IF EXISTS "prioridade_update_admin_diretora" ON public.empresa_prioridade_maxima;

CREATE POLICY "prioridade_insert_cadastro"
ON public.empresa_prioridade_maxima FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'diretora')
  OR public.has_role(auth.uid(),'comum')
  OR public.has_role(auth.uid(),'administradoras')
);

CREATE POLICY "prioridade_update_cadastro"
ON public.empresa_prioridade_maxima FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'admin')
  OR public.has_role(auth.uid(),'diretora')
  OR public.has_role(auth.uid(),'comum')
  OR public.has_role(auth.uid(),'administradoras')
);