
-- Tabela corretoras
CREATE TABLE public.corretoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  email text,
  telefone text,
  responsavel text,
  portal_ativo boolean NOT NULL DEFAULT true,
  portal_secoes jsonb NOT NULL DEFAULT '{"contrato":true,"vidas":true,"movimentacoes":true,"chat":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretoras TO authenticated;
GRANT ALL ON public.corretoras TO service_role;
ALTER TABLE public.corretoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage corretoras" ON public.corretoras
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'));

-- Vinculo corretora -> empresas
CREATE TABLE public.corretora_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretora_id uuid NOT NULL REFERENCES public.corretoras(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (corretora_id, empresa_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretora_empresas TO authenticated;
GRANT ALL ON public.corretora_empresas TO service_role;
ALTER TABLE public.corretora_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage corretora_empresas" ON public.corretora_empresas
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'));

-- Vinculo corretora -> usuarios
CREATE TABLE public.corretora_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corretora_id uuid NOT NULL REFERENCES public.corretoras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (corretora_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.corretora_usuarios TO authenticated;
GRANT ALL ON public.corretora_usuarios TO service_role;
ALTER TABLE public.corretora_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage corretora_usuarios" ON public.corretora_usuarios
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin_interno'));

CREATE POLICY "Corretora view own user link" ON public.corretora_usuarios
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Corretora view own vinculos" ON public.corretora_empresas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.corretora_usuarios cu WHERE cu.corretora_id = corretora_empresas.corretora_id AND cu.user_id = auth.uid()));

CREATE POLICY "Corretora view own corretora" ON public.corretoras
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.corretora_usuarios cu WHERE cu.corretora_id = corretoras.id AND cu.user_id = auth.uid()));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_corretoras_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_corretoras_updated_at
  BEFORE UPDATE ON public.corretoras
  FOR EACH ROW EXECUTE FUNCTION public.tg_corretoras_updated_at();

-- Estende user_pode_ver_empresa para incluir corretoras
CREATE OR REPLACE FUNCTION public.user_pode_ver_empresa(_empresa uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text = 'admin_interno'
    )
    OR EXISTS (
      SELECT 1 FROM public.empresa_usuarios
      WHERE user_id = auth.uid() AND empresa_id = _empresa
    )
    OR EXISTS (
      SELECT 1
      FROM public.corretora_usuarios cu
      JOIN public.corretora_empresas ce ON ce.corretora_id = cu.corretora_id
      WHERE cu.user_id = auth.uid() AND ce.empresa_id = _empresa
    );
$function$;

-- Helper para o cliente saber a qual corretora pertence
CREATE OR REPLACE FUNCTION public.get_minha_corretora()
RETURNS TABLE(corretora_id uuid, nome text, portal_ativo boolean, portal_secoes jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.nome, c.portal_ativo, c.portal_secoes
  FROM public.corretoras c
  JOIN public.corretora_usuarios cu ON cu.corretora_id = c.id
  WHERE cu.user_id = auth.uid()
  LIMIT 1;
$$;
