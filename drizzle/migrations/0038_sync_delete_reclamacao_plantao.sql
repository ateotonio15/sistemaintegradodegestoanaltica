CREATE OR REPLACE FUNCTION public.sync_delete_plantao_para_demanda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR OLD.demanda_id IS NULL THEN RETURN OLD; END IF;
  DELETE FROM public.demandas WHERE id = OLD.demanda_id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_sync_delete_plantao_demanda AFTER DELETE ON public.plantoes_atendimentos
FOR EACH ROW EXECUTE FUNCTION public.sync_delete_plantao_para_demanda();

CREATE OR REPLACE FUNCTION public.sync_delete_demanda_para_plantao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
  DELETE FROM public.plantoes_atendimentos WHERE demanda_id = OLD.id;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_sync_delete_demanda_plantao BEFORE DELETE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.sync_delete_demanda_para_plantao();