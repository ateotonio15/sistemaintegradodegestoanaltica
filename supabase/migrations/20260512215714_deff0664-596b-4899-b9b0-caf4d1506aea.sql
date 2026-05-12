
-- 1) Adiciona valor ao enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretora';
COMMIT;

-- 2) Espelha políticas RLS de 'visualizacao' para 'diretora'
CREATE POLICY "Diretora manage alertas_reajuste"
ON public.alertas_reajuste FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view all empresa_usuarios"
ON public.empresa_usuarios FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view all empresas"
ON public.empresas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view all movimentacoes"
ON public.movimentacoes FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora manage reajuste_faixas"
ON public.reajuste_faixas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora manage reajustes_anuais"
ON public.reajustes_anuais FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role));

CREATE POLICY "Diretora view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'diretora'::app_role) AND user_id = auth.uid());

-- 3) Permite Diretora solicitar reajuste (mesma função da Visualização)
CREATE OR REPLACE FUNCTION public.solicitar_reajuste(p_empresa_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_empresa record;
  v_user_nome text;
  v_id uuid;
  v_ano int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'visualizacao'::app_role)
    OR public.has_role(v_uid, 'diretora'::app_role)
    OR public.has_role(v_uid, 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Apenas Visualização, Diretora ou Admin podem solicitar reajuste';
  END IF;

  SELECT id, nome INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF EXISTS (SELECT 1 FROM public.reajustes_anuais WHERE empresa_id = p_empresa_id AND ano = v_ano) THEN
    RAISE EXCEPTION 'Já existe um reajuste/solicitação para esta empresa em %', v_ano;
  END IF;

  SELECT display_name INTO v_user_nome FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.reajustes_anuais
    (empresa_id, ano, status_reajuste, status, valor_antigo_centavos, percentual,
     valor_reajustado_centavos, data_aplicacao, usuario_id, usuario_nome,
     meses_retroativos, valor_retroativo_centavos, valor_final_centavos)
  VALUES
    (p_empresa_id, v_ano, 'solicitado', 'Solicitado', 0, 0, 0, NULL, v_uid, v_user_nome, 0, 0, 0)
  RETURNING v_id;

  RETURN v_id;
END;
$function$;
