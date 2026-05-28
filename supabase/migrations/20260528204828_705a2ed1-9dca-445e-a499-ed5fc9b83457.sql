-- Fix 1: Restrict visualizacao role to SELECT only on reajuste tables
DROP POLICY IF EXISTS "Visualizacao manage alertas_reajuste" ON public.alertas_reajuste;
DROP POLICY IF EXISTS "Visualizacao manage reajustes_anuais" ON public.reajustes_anuais;
DROP POLICY IF EXISTS "Visualizacao manage reajuste_faixas" ON public.reajuste_faixas;

CREATE POLICY "Visualizacao read alertas_reajuste"
  ON public.alertas_reajuste FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Visualizacao read reajustes_anuais"
  ON public.reajustes_anuais FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

CREATE POLICY "Visualizacao read reajuste_faixas"
  ON public.reajuste_faixas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'visualizacao'::app_role));

-- Fix 2: Align storage SELECT policy on arquivos-financeiro with metadata access
DROP POLICY IF EXISTS "Internal roles read arquivos-financeiro storage" ON storage.objects;
CREATE POLICY "Internal roles read arquivos-financeiro storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'arquivos-financeiro'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
      OR public.has_role(auth.uid(), 'visualizacao'::app_role)
      OR public.has_role(auth.uid(), 'administradoras'::app_role)
    )
  );