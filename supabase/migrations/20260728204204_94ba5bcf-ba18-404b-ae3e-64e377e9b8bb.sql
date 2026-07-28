ALTER TABLE public.atendimentos_mensagens
  ADD COLUMN IF NOT EXISTS lida_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_atd_msg_atd_lida
  ON public.atendimentos_mensagens (atendimento_id) WHERE lida_em IS NULL;

-- Staff pode marcar mensagens da empresa como lidas
DROP POLICY IF EXISTS "staff marca mensagem como lida" ON public.atendimentos_mensagens;
CREATE POLICY "staff marca mensagem como lida" ON public.atendimentos_mensagens
FOR UPDATE USING (
  autor_tipo = 'empresa'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'comum'::app_role)
    OR has_role(auth.uid(), 'financeiro'::app_role)
    OR has_role(auth.uid(), 'executivo'::app_role)
    OR has_role(auth.uid(), 'diretora'::app_role)
  )
) WITH CHECK (
  autor_tipo = 'empresa'
);

-- Empresa pode marcar mensagens do staff como lidas
DROP POLICY IF EXISTS "empresa marca mensagem como lida" ON public.atendimentos_mensagens;
CREATE POLICY "empresa marca mensagem como lida" ON public.atendimentos_mensagens
FOR UPDATE USING (
  autor_tipo = 'staff'
  AND EXISTS (
    SELECT 1 FROM public.atendimentos a
    WHERE a.id = atendimentos_mensagens.atendimento_id
      AND public.user_pode_ver_empresa(a.empresa_id)
  )
) WITH CHECK (
  autor_tipo = 'staff'
);

ALTER TABLE public.atendimentos_mensagens REPLICA IDENTITY FULL;