
-- 1) Scope storage SELECT on anexos-financeiro to own-company files for administradoras/visualizacao
DROP POLICY IF EXISTS "Restricted read anexos-financeiro storage" ON storage.objects;

CREATE POLICY "Restricted read anexos-financeiro storage"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'anexos-financeiro'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'financeiro'::app_role)
    OR public.has_role(auth.uid(), 'diretora'::app_role)
    OR (
      (public.has_role(auth.uid(), 'administradoras'::app_role)
       OR public.has_role(auth.uid(), 'visualizacao'::app_role))
      AND EXISTS (
        SELECT 1
        FROM public.empresa_usuarios eu
        WHERE eu.user_id = auth.uid()
          AND eu.empresa_id::text = (storage.foldername(name))[1]
      )
    )
  )
);

-- 2) Remove unused/over-broad 'process-job-%' realtime topic clause; rebuild policy without it
DROP POLICY IF EXISTS "App roles can use realtime" ON realtime.messages;

CREATE POLICY "App roles can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (realtime.topic() = ('notificacoes-realtime-' || auth.uid()::text))
  OR (
    realtime.topic() = ANY (ARRAY[
      'alertas-financeiro-realtime',
      'alertas-vencimento-realtime',
      'faturamentos-nao-enviados-realtime'
    ])
    AND (public.has_role(auth.uid(), 'financeiro'::app_role)
         OR public.has_role(auth.uid(), 'diretora'::app_role))
  )
  OR (
    realtime.topic() LIKE 'financeiro-realtime-%'
    AND (public.has_role(auth.uid(), 'financeiro'::app_role)
         OR public.has_role(auth.uid(), 'diretora'::app_role)
         OR public.has_role(auth.uid(), 'comum'::app_role))
  )
  OR (realtime.topic() = 'diretora-analise-realtime'
      AND public.has_role(auth.uid(), 'diretora'::app_role))
  OR (realtime.topic() = 'vendas-correcao-realtime'
      AND public.has_role(auth.uid(), 'vendas'::app_role))
  OR (
    realtime.topic() = ANY (ARRAY[
      'dashboard-empresas-realtime',
      'empresas-vidas-realtime',
      'reajustes-realtime',
      'alertas-reajuste-banner',
      'impl-andamento-realtime'
    ])
    AND (public.has_role(auth.uid(), 'comum'::app_role)
         OR public.has_role(auth.uid(), 'financeiro'::app_role)
         OR public.has_role(auth.uid(), 'diretora'::app_role)
         OR public.has_role(auth.uid(), 'visualizacao'::app_role)
         OR public.has_role(auth.uid(), 'administradoras'::app_role)
         OR public.has_role(auth.uid(), 'executivo'::app_role)
         OR public.has_role(auth.uid(), 'vendas'::app_role))
  )
);

-- 3) Remove saude_agendamentos from Realtime publication (no app code subscribes to it,
--    and broadcasting could leak rows to roles without SELECT access)
ALTER PUBLICATION supabase_realtime DROP TABLE public.saude_agendamentos;
