
-- Create saude_agendamentos table
CREATE TABLE public.saude_agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo_palestra text NOT NULL,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  enfermeira_user_id uuid NOT NULL,
  observacao text,
  status text NOT NULL DEFAULT 'confirmado',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saude_agendamentos ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admin full access saude_agendamentos"
ON public.saude_agendamentos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Executivo view
CREATE POLICY "Executivo view all saude_agendamentos"
ON public.saude_agendamentos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'executivo'));

-- Enfermeira policies
CREATE POLICY "Enfermeira view own saude_agendamentos"
ON public.saude_agendamentos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'enfermeira') AND enfermeira_user_id = auth.uid());

CREATE POLICY "Enfermeira insert own saude_agendamentos"
ON public.saude_agendamentos FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'enfermeira') AND enfermeira_user_id = auth.uid());

CREATE POLICY "Enfermeira update own saude_agendamentos"
ON public.saude_agendamentos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'enfermeira') AND enfermeira_user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'enfermeira') AND enfermeira_user_id = auth.uid());

-- Enfermeira view profiles
CREATE POLICY "Enfermeira view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'enfermeira'));

-- Enfermeira view own role
CREATE POLICY "Enfermeira view own role"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'enfermeira') AND user_id = auth.uid());

-- Enfermeira view empresa_usuarios
CREATE POLICY "Enfermeira view all empresa_usuarios"
ON public.empresa_usuarios FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'enfermeira'));

-- Updated_at trigger
CREATE TRIGGER update_saude_agendamentos_updated_at
BEFORE UPDATE ON public.saude_agendamentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.saude_agendamentos;
