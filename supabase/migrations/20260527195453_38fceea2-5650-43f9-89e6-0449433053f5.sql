
-- 1) Movimentações: exigir role operacional + vínculo
DROP POLICY IF EXISTS "User update linked movimentacoes" ON public.movimentacoes;
CREATE POLICY "User update linked movimentacoes"
ON public.movimentacoes
FOR UPDATE
TO authenticated
USING (
  (public.has_role(auth.uid(), 'comum'::app_role) OR public.has_role(auth.uid(), 'administradoras'::app_role))
  AND (
    EXISTS (SELECT 1 FROM public.empresa_usuarios eu WHERE eu.empresa_id = movimentacoes.empresa_id AND eu.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = movimentacoes.empresa_id AND e.responsavel_user_id = auth.uid())
  )
);

-- 2) Realtime: restringir aos perfis que leem dados, excluindo vendas/enfermeira
DROP POLICY IF EXISTS "Authenticated app users can use realtime" ON realtime.messages;
CREATE POLICY "App roles can use realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'financeiro'::app_role)
  OR public.has_role(auth.uid(), 'diretora'::app_role)
  OR public.has_role(auth.uid(), 'visualizacao'::app_role)
  OR public.has_role(auth.uid(), 'administradoras'::app_role)
  OR public.has_role(auth.uid(), 'comum'::app_role)
  OR public.has_role(auth.uid(), 'executivo'::app_role)
);
