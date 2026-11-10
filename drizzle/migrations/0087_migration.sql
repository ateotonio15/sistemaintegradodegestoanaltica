ALTER TABLE public.demandas_cirurgia_notificacoes ADD COLUMN IF NOT EXISTS destinatario_id uuid;

CREATE OR REPLACE FUNCTION public.notificar_cirurgia_criador_demanda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_dem record;
BEGIN
  IF NEW.situacao <> 'agendada' OR NEW.data_procedimento IS NULL OR NEW.agendamento_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT id, nome_cliente, created_by INTO v_dem FROM demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  INSERT INTO demandas_cirurgia_notificacoes (demanda_id, agendamento_id, data_cirurgia, nome_paciente, nome_medico, destinatario_id)
  VALUES (NEW.demanda_id, NEW.agendamento_id, NEW.data_procedimento, COALESCE(v_dem.nome_cliente,''), COALESCE(NEW.nome_medico,''), v_dem.created_by)
  ON CONFLICT (demanda_id, agendamento_id, data_cirurgia)
  DO UPDATE SET destinatario_id = COALESCE(demandas_cirurgia_notificacoes.destinatario_id, EXCLUDED.destinatario_id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notificar_cirurgia_criador ON public.demandas_cirurgia_situacao;
CREATE TRIGGER trg_notificar_cirurgia_criador AFTER INSERT OR UPDATE ON public.demandas_cirurgia_situacao
FOR EACH ROW EXECUTE FUNCTION public.notificar_cirurgia_criador_demanda();

DROP POLICY IF EXISTS cirurgia_avisos_leitura ON public.demandas_cirurgia_notificacoes;
CREATE POLICY cirurgia_avisos_leitura ON public.demandas_cirurgia_notificacoes FOR SELECT TO authenticated
USING (
  (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'executivo'::app_role) OR has_role(auth.uid(),'executivo_externo'::app_role) OR destinatario_id = auth.uid())
  AND EXISTS (SELECT 1 FROM demandas d WHERE d.id = demandas_cirurgia_notificacoes.demanda_id)
);

-- backfill for already-flagged complaints
UPDATE public.demandas_cirurgia_situacao SET alterado_em = alterado_em WHERE situacao = 'agendada';