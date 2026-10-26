CREATE TABLE public.demandas_cirurgia_notificacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), demanda_id uuid NOT NULL REFERENCES public.demandas(id) ON DELETE CASCADE,
 agendamento_id text NOT NULL, data_cirurgia date NOT NULL, nome_paciente text NOT NULL, nome_medico text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(demanda_id,agendamento_id,data_cirurgia)
);
GRANT SELECT ON public.demandas_cirurgia_notificacoes TO authenticated;
GRANT ALL ON public.demandas_cirurgia_notificacoes TO service_role;
ALTER TABLE public.demandas_cirurgia_notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cirurgia_avisos_leitura ON public.demandas_cirurgia_notificacoes FOR SELECT TO authenticated USING (
 (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'executivo_externo'))
 AND EXISTS (SELECT 1 FROM public.demandas d WHERE d.id=demanda_id)
);
CREATE TABLE public.demandas_cirurgia_lidas (
 notificacao_id uuid NOT NULL REFERENCES public.demandas_cirurgia_notificacoes(id) ON DELETE CASCADE,
 user_id uuid NOT NULL, lida_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(notificacao_id,user_id)
);
GRANT SELECT,INSERT ON public.demandas_cirurgia_lidas TO authenticated;
GRANT ALL ON public.demandas_cirurgia_lidas TO service_role;
ALTER TABLE public.demandas_cirurgia_lidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cirurgia_lidas_leitura ON public.demandas_cirurgia_lidas FOR SELECT TO authenticated USING (
 user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.demandas_cirurgia_notificacoes n WHERE n.id=notificacao_id)
);
CREATE POLICY cirurgia_lidas_registro ON public.demandas_cirurgia_lidas FOR INSERT TO authenticated WITH CHECK (
 user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.demandas_cirurgia_notificacoes n WHERE n.id=notificacao_id)
);
CREATE TABLE public.demandas_cirurgia_sync (
 id boolean PRIMARY KEY DEFAULT true, ultima_consulta_em timestamptz, ultimo_sucesso_em timestamptz, erro text,
 reservado_ate timestamptz
);
GRANT SELECT ON public.demandas_cirurgia_sync TO authenticated;
GRANT ALL ON public.demandas_cirurgia_sync TO service_role;
ALTER TABLE public.demandas_cirurgia_sync ENABLE ROW LEVEL SECURITY;
CREATE POLICY cirurgia_sync_leitura ON public.demandas_cirurgia_sync FOR SELECT TO authenticated USING (
 public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'executivo') OR public.has_role(auth.uid(),'executivo_externo')
);
CREATE FUNCTION public.reservar_sync_cirurgias() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 INSERT INTO demandas_cirurgia_sync(id) VALUES(true) ON CONFLICT DO NOTHING;
 UPDATE demandas_cirurgia_sync SET reservado_ate=now()+interval '2 minutes', ultima_consulta_em=now()
 WHERE id=true AND (reservado_ate IS NULL OR reservado_ate < now());
 RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.reservar_sync_cirurgias() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_sync_cirurgias() TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas_cirurgia_notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas_cirurgia_lidas;
