
-- 1. notificacoes: restrict writes to admin only
CREATE POLICY "Admin insert notificacoes" ON public.notificacoes
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin update notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin delete notificacoes" ON public.notificacoes
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. reajustes_anuais: diretora read-only (drop ALL policy; SELECT already covered by "Internal roles read reajustes_anuais")
DROP POLICY IF EXISTS "Diretora manage reajustes_anuais" ON public.reajustes_anuais;

-- 3. vidas_historico_administradoras: restrict to internal roles
DROP POLICY IF EXISTS "Authenticated read vidas_historico_administradoras" ON public.vidas_historico_administradoras;
CREATE POLICY "Internal roles read vidas_historico_administradoras"
  ON public.vidas_historico_administradoras
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'administradoras'::app_role)
    OR public.has_role(auth.uid(), 'comum'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR public.has_role(auth.uid(), 'visualizacao'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
  );

-- 4. implantacao_alertas: include financeiro on scoped read
DROP POLICY IF EXISTS "Scoped read impl alertas" ON public.implantacao_alertas;
CREATE POLICY "Scoped read impl alertas"
  ON public.implantacao_alertas
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR public.has_role(auth.uid(), 'visualizacao'::app_role)
    OR public.has_role(auth.uid(), 'administradoras'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR (public.has_role(auth.uid(), 'comum'::app_role)
        AND destinatario_role = 'comum'
        AND (destinatario_user_id IS NULL OR destinatario_user_id = auth.uid()))
    OR (public.has_role(auth.uid(), 'vendas'::app_role)
        AND (destinatario_role = 'vendas' OR criado_por = auth.uid()))
  );

-- 5. storage: restrict read policy to authenticated role
DROP POLICY IF EXISTS "Restricted read anexos-financeiro storage" ON storage.objects;
CREATE POLICY "Restricted read anexos-financeiro storage"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'anexos-financeiro'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'financeiro'::app_role)
      OR public.has_role(auth.uid(), 'comum'::app_role)
      OR public.has_role(auth.uid(), 'administradoras'::app_role)
      OR public.has_role(auth.uid(), 'diretora'::app_role)
      OR public.has_role(auth.uid(), 'visualizacao'::app_role)
      OR owner = auth.uid()
    )
  );
