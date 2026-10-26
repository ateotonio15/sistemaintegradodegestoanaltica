CREATE TABLE public.config_email_relatorios (
 id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
 dominio text NOT NULL,
 nome_remetente text NOT NULL CHECK (length(trim(nome_remetente)) > 0),
 email_remetente text NOT NULL,
 email_resposta text,
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_por uuid NOT NULL DEFAULT auth.uid(),
 CONSTRAINT dominio_email_valido CHECK (dominio = lower(trim(dominio)) AND dominio ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
 CONSTRAINT remetente_email_valido CHECK (email_remetente ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' AND split_part(lower(email_remetente), '@', 2) = dominio),
 CONSTRAINT resposta_email_valido CHECK (email_resposta IS NULL OR email_resposta ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);
GRANT SELECT, INSERT, UPDATE ON public.config_email_relatorios TO authenticated;
GRANT ALL ON public.config_email_relatorios TO service_role;
ALTER TABLE public.config_email_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_email_admin_select ON public.config_email_relatorios FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY config_email_admin_insert ON public.config_email_relatorios FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND atualizado_por = auth.uid());
CREATE POLICY config_email_admin_update ON public.config_email_relatorios FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin') AND atualizado_por = auth.uid());
COMMENT ON TABLE public.config_email_relatorios IS 'Sender metadata only. Saving does not verify domain or activate email sending. Never store SMTP passwords or API keys here.';