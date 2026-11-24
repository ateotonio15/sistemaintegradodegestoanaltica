ALTER TABLE public.plantoes_atendimentos
  ADD COLUMN IF NOT EXISTS motivo text,
  ADD COLUMN IF NOT EXISTS especialidade text,
  ADD COLUMN IF NOT EXISTS classificacao_origem text,
  ADD COLUMN IF NOT EXISTS classificado_em timestamptz;

CREATE OR REPLACE FUNCTION public.plantao_atend_reset_classificacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.observacao IS DISTINCT FROM OLD.observacao OR NEW.assunto IS DISTINCT FROM OLD.assunto)
     AND COALESCE(NEW.classificacao_origem,'') <> 'manual'
     AND NEW.motivo IS NOT DISTINCT FROM OLD.motivo THEN
    NEW.motivo := NULL; NEW.especialidade := NULL; NEW.classificacao_origem := NULL; NEW.classificado_em := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_plantao_atend_reset_class ON public.plantoes_atendimentos;
CREATE TRIGGER trg_plantao_atend_reset_class BEFORE UPDATE ON public.plantoes_atendimentos
  FOR EACH ROW EXECUTE FUNCTION public.plantao_atend_reset_classificacao();

CREATE TABLE public.atendimento_classificacao_listas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lista text NOT NULL CHECK (lista IN ('motivo','especialidade')),
  valor text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lista, valor)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atendimento_classificacao_listas TO authenticated;
GRANT ALL ON public.atendimento_classificacao_listas TO service_role;
ALTER TABLE public.atendimento_classificacao_listas ENABLE ROW LEVEL SECURITY;
CREATE POLICY acl_read ON public.atendimento_classificacao_listas FOR SELECT TO authenticated USING (true);
CREATE POLICY acl_admin ON public.atendimento_classificacao_listas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.atendimento_classificacao_listas (lista, valor, ordem) VALUES
('motivo','Consulta com especialista',1),('motivo','Dificuldade com o app Samel',2),('motivo','Exames',3),
('motivo','Guia de autorização',4),('motivo','Alteração cadastral',5),('motivo','Agendamento em telemedicina',6),
('motivo','Reclamação (vaga/encaixe)',7),('motivo','Outros',99),
('especialidade','Ortopedia',1),('especialidade','Endocrinologia',2),('especialidade','Ginecologia',3),
('especialidade','Saúde mental (psiquiatria, psicologia, neuropsicologia)',4),('especialidade','Cirurgias',5),
('especialidade','Urologia',6),('especialidade','Oncologia',7),('especialidade','Neuropediatria',8),
('especialidade','Dermatologia',9),('especialidade','Cardiologia',10),('especialidade','Outras especialidades',99);