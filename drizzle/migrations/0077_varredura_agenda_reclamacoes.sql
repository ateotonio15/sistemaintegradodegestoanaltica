CREATE TABLE IF NOT EXISTS public.demandas_cirurgia_situacao (
 demanda_id uuid PRIMARY KEY REFERENCES public.demandas(id) ON DELETE CASCADE,
 situacao text NOT NULL CHECK (situacao IN ('agendada','aguardando','realizado','cancelado','validar','erro')),
 data_procedimento date,
 status_api text,
 agendamento_id text,
 assinatura text,
 consultado_em timestamptz NOT NULL DEFAULT now(),
 alterado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demandas_cirurgia_situacao TO authenticated;
GRANT ALL ON public.demandas_cirurgia_situacao TO service_role;
ALTER TABLE public.demandas_cirurgia_situacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY cirurgia_situacao_leitura ON public.demandas_cirurgia_situacao FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.demandas d WHERE d.id = demanda_id));

CREATE TABLE IF NOT EXISTS public.demandas_cirurgia_varreduras (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 origem text NOT NULL CHECK (origem IN ('manual','diaria')),
 usuario_id uuid,
 iniciado_em timestamptz NOT NULL DEFAULT now(),
 concluido_em timestamptz,
 analisadas int NOT NULL DEFAULT 0,
 agendadas int NOT NULL DEFAULT 0,
 aguardando int NOT NULL DEFAULT 0,
 realizados int NOT NULL DEFAULT 0,
 cancelados int NOT NULL DEFAULT 0,
 validar int NOT NULL DEFAULT 0,
 erros int NOT NULL DEFAULT 0,
 ignoradas int NOT NULL DEFAULT 0,
 atualizadas int NOT NULL DEFAULT 0,
 erro text
);
GRANT SELECT ON public.demandas_cirurgia_varreduras TO authenticated;
GRANT ALL ON public.demandas_cirurgia_varreduras TO service_role;
ALTER TABLE public.demandas_cirurgia_varreduras ENABLE ROW LEVEL SECURITY;
CREATE POLICY cirurgia_varreduras_leitura ON public.demandas_cirurgia_varreduras FOR SELECT TO authenticated
 USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'executivo_externo'));