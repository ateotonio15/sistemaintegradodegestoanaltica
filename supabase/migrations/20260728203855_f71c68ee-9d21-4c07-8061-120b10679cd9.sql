DROP POLICY IF EXISTS "empresa envia mensagem" ON public.atendimentos_mensagens;
CREATE POLICY "empresa envia mensagem" ON public.atendimentos_mensagens
FOR INSERT WITH CHECK (
  autor_tipo = 'empresa'
  AND autor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.id = atendimentos_mensagens.atendimento_id
      AND public.user_pode_ver_empresa(a.empresa_id)
  )
);