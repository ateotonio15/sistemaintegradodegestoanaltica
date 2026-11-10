ALTER POLICY cirurgia_avisos_leitura ON public.demandas_cirurgia_notificacoes TO authenticated USING (
  (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'executivo'::public.app_role) OR public.has_role(auth.uid(), 'executivo_externo'::public.app_role))
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demandas_cirurgia_notificacoes.demanda_id
      AND (public.has_role(auth.uid(), 'admin'::public.app_role)
        OR COALESCE(demandas_cirurgia_notificacoes.destinatario_id, d.created_by) = auth.uid())
  )
);