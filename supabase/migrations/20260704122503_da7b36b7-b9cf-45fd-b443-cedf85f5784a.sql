-- Permitir que usuários Comum e Administradoras excluam qualquer anexo de movimentação
-- (antes limitava a uploaded_by = auth.uid(), causando falhas silenciosas quando outro
-- usuário do mesmo perfil havia enviado o arquivo).

DROP POLICY IF EXISTS "Comum delete own anexos_movimentacao" ON public.anexos_movimentacao;
CREATE POLICY "Comum delete anexos_movimentacao"
ON public.anexos_movimentacao
FOR DELETE
USING (has_role(auth.uid(), 'comum'::app_role));

DROP POLICY IF EXISTS "Administradoras delete own anexos_movimentacao" ON public.anexos_movimentacao;
CREATE POLICY "Administradoras delete anexos_movimentacao"
ON public.anexos_movimentacao
FOR DELETE
USING (has_role(auth.uid(), 'administradoras'::app_role));