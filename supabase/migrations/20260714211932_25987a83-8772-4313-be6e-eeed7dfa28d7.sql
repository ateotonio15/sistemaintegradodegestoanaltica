
CREATE TABLE public.atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mensagem_original text NOT NULL,
  resumo text,
  setor_destino text NOT NULL CHECK (setor_destino IN ('cadastro','relacionamento','financeiro')),
  setor_original text NOT NULL CHECK (setor_original IN ('cadastro','relacionamento','financeiro')),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','resolvido')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimentos TO authenticated;
GRANT ALL ON public.atendimentos TO service_role;

ALTER TABLE public.atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa e admin_interno leem atendimentos"
ON public.atendimentos FOR SELECT TO authenticated
USING (public.user_pode_ver_empresa(empresa_id));

CREATE POLICY "empresa e admin_interno criam atendimentos"
ON public.atendimentos FOR INSERT TO authenticated
WITH CHECK (public.user_pode_ver_empresa(empresa_id));

CREATE POLICY "empresa e admin_interno atualizam atendimentos"
ON public.atendimentos FOR UPDATE TO authenticated
USING (public.user_pode_ver_empresa(empresa_id))
WITH CHECK (public.user_pode_ver_empresa(empresa_id));

CREATE POLICY "admin_interno remove atendimentos"
ON public.atendimentos FOR DELETE TO authenticated
USING (public.is_admin_interno());

CREATE INDEX idx_atendimentos_empresa ON public.atendimentos(empresa_id, criado_em DESC);

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_atendimentos_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_atendimentos_atualizado_em
BEFORE UPDATE ON public.atendimentos
FOR EACH ROW EXECUTE FUNCTION public.tg_atendimentos_atualizado_em();
