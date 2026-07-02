
DROP POLICY IF EXISTS triagens_del ON public.triagens;
CREATE POLICY triagens_del ON public.triagens FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    has_role(auth.uid(), 'enfermeira'::app_role)
    AND (
      created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.acoes_saude a
        WHERE a.id = triagens.acao_id
          AND a.enfermeira_user_id = auth.uid()
      )
    )
  )
);
