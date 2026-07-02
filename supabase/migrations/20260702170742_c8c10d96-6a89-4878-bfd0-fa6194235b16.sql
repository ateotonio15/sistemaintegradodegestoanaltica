DROP POLICY IF EXISTS triagens_ins ON public.triagens;

CREATE POLICY triagens_ins ON public.triagens
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretora'::app_role)
  OR (
    has_role(auth.uid(), 'enfermeira'::app_role)
    AND created_by = auth.uid()
    AND acao_saude_pertence_empresa(acao_id, empresa_id)
    AND EXISTS (
      SELECT 1 FROM acoes_saude a
      WHERE a.id = triagens.acao_id
        AND a.enfermeira_user_id = auth.uid()
    )
  )
);