CREATE TABLE public.uber_unificacao_log (
 id uuid primary key default gen_random_uuid(),
 corrida_id uuid not null,
 colaborador_anterior text,
 colaborador_novo text,
 passageiro_id_anterior uuid,
 observacao_anterior text,
 motivo_anterior text,
 alterado_em timestamptz not null default now()
);
GRANT SELECT ON public.uber_unificacao_log TO authenticated;
GRANT ALL ON public.uber_unificacao_log TO service_role;
ALTER TABLE public.uber_unificacao_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin le log unificacao" ON public.uber_unificacao_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));