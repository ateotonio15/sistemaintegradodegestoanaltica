
-- 1) security_locks: remove leitura direta; hash só via RPC/servidor
DROP POLICY IF EXISTS "Ler status do cadeado (autenticado)" ON public.security_locks;
REVOKE SELECT ON public.security_locks FROM authenticated;

-- 2) cs_score_empresas: leitura restrita a admin/diretora/executivo
DROP POLICY IF EXISTS "cs_score_empresas_select_auth" ON public.cs_score_empresas;
CREATE POLICY "cs_score_empresas_select_priv"
  ON public.cs_score_empresas FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR public.has_role(auth.uid(), 'executivo'::app_role)
  );

-- 3) painel_tv_meta_diaria: leitura restrita a admin/diretora/financeiro
DROP POLICY IF EXISTS "auth read meta diaria" ON public.painel_tv_meta_diaria;
CREATE POLICY "priv read meta diaria"
  ON public.painel_tv_meta_diaria FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 4) tg_atendimentos_atualizado_em: search_path fixo
CREATE OR REPLACE FUNCTION public.tg_atendimentos_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$function$;
