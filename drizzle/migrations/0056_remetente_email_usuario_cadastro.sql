CREATE TABLE public.config_email_remetente_usuario (
  user_id uuid PRIMARY KEY,
  nome_remetente text NOT NULL CHECK (char_length(nome_remetente) BETWEEN 1 AND 120),
  email_remetente text NOT NULL CHECK (email_remetente ~* '^[^\s@]+@samel\.com\.br$'),
  email_resposta text CHECK (email_resposta IS NULL OR email_resposta ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.config_email_remetente_usuario TO authenticated;
GRANT ALL ON public.config_email_remetente_usuario TO service_role;
ALTER TABLE public.config_email_remetente_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cadastro gerencia o proprio remetente" ON public.config_email_remetente_usuario
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'comum'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'comum'));
CREATE POLICY "Admin consulta remetentes" ON public.config_email_remetente_usuario
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));