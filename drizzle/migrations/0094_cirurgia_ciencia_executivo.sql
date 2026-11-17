CREATE TABLE public.demandas_cirurgia_ciencias (
  notificacao_id uuid NOT NULL REFERENCES public.demandas_cirurgia_notificacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  observacao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacao_id, user_id)
);
GRANT SELECT ON public.demandas_cirurgia_ciencias TO authenticated;
GRANT ALL ON public.demandas_cirurgia_ciencias TO service_role;
ALTER TABLE public.demandas_cirurgia_ciencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ciencia_propria_leitura" ON public.demandas_cirurgia_ciencias FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.avisos_cirurgia_pendentes_executivo()
RETURNS TABLE(id uuid, demanda_id uuid, data_cirurgia date, nome_paciente text, nome_medico text, empresa text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT n.id, n.demanda_id, n.data_cirurgia, n.nome_paciente, n.nome_medico, d.empresa, n.created_at
  FROM demandas_cirurgia_notificacoes n
  JOIN demandas d ON d.id = n.demanda_id
  WHERE auth.uid() IS NOT NULL
    AND (has_role(auth.uid(),'executivo') OR has_role(auth.uid(),'executivo_externo') OR has_role(auth.uid(),'admin'))
    AND (
      COALESCE(n.destinatario_id, d.created_by) = auth.uid()
      OR EXISTS (SELECT 1 FROM empresas e WHERE e.executiva_user_id = auth.uid()
                 AND upper(trim(e.nome)) = upper(trim(d.empresa)))
    )
    AND NOT EXISTS (SELECT 1 FROM demandas_cirurgia_ciencias c WHERE c.notificacao_id = n.id AND c.user_id = auth.uid())
  ORDER BY n.data_cirurgia, n.created_at;
$$;
REVOKE ALL ON FUNCTION public.avisos_cirurgia_pendentes_executivo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.avisos_cirurgia_pendentes_executivo() TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_ciencia_cirurgia(_notificacao_id uuid, _observacao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF length(trim(coalesce(_observacao,''))) < 3 THEN
    RAISE EXCEPTION 'Escreva uma observação para marcar como lido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.avisos_cirurgia_pendentes_executivo() a WHERE a.id = _notificacao_id) THEN
    RAISE EXCEPTION 'Aviso não encontrado ou já marcado como lido';
  END IF;
  INSERT INTO demandas_cirurgia_ciencias(notificacao_id, user_id, observacao)
  VALUES (_notificacao_id, auth.uid(), left(trim(_observacao), 1000));
  INSERT INTO demandas_cirurgia_lidas(notificacao_id, user_id) VALUES (_notificacao_id, auth.uid())
  ON CONFLICT DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.registrar_ciencia_cirurgia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_ciencia_cirurgia(uuid, text) TO authenticated;