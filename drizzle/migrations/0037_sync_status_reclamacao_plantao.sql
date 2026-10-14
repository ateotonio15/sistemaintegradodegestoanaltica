CREATE OR REPLACE FUNCTION public.sync_plantao_status_para_demanda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE novo text;
BEGIN
  IF pg_trigger_depth() > 1 OR NEW.demanda_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.assunto IS NOT DISTINCT FROM OLD.assunto AND NEW.resolvido IS NOT DISTINCT FROM OLD.resolvido THEN RETURN NEW; END IF;
  novo := lower(trim(split_part(coalesce(NEW.assunto,''), '·', 3)));
  IF NEW.resolvido OR novo = 'resolvido' THEN
    UPDATE public.demandas SET resolvido_executiva = true,
      data_resolucao_executiva = coalesce(data_resolucao_executiva, (now() AT TIME ZONE 'America/Manaus')::date)
    WHERE id = NEW.demanda_id AND resolvido_executiva IS DISTINCT FROM true;
  ELSE
    UPDATE public.demandas SET resolvido_executiva = false, data_resolucao_executiva = NULL
    WHERE id = NEW.demanda_id AND resolvido_executiva = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_plantao_status_demanda
AFTER UPDATE ON public.plantoes_atendimentos
FOR EACH ROW EXECUTE FUNCTION public.sync_plantao_status_para_demanda();

CREATE OR REPLACE FUNCTION public.sync_demanda_status_para_plantao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.resolvido_executiva IS NOT DISTINCT FROM OLD.resolvido_executiva THEN RETURN NEW; END IF;
  IF NEW.resolvido_executiva THEN
    UPDATE public.plantoes_atendimentos SET resolvido = true,
      assunto = trim(split_part(coalesce(assunto,'Reclamação'), '·', 1)) || ' · ' ||
                coalesce(nullif(trim(split_part(coalesce(assunto,''), '·', 2)),''), 'Presencial') || ' · Resolvido'
    WHERE demanda_id = NEW.id;
  ELSE
    UPDATE public.plantoes_atendimentos SET resolvido = false,
      assunto = trim(split_part(coalesce(assunto,'Reclamação'), '·', 1)) || ' · ' ||
                coalesce(nullif(trim(split_part(coalesce(assunto,''), '·', 2)),''), 'Presencial') || ' · ' ||
                CASE WHEN NEW.resolvido_setor THEN 'Em andamento' ELSE 'Pendente' END
    WHERE demanda_id = NEW.id AND (resolvido = true OR lower(trim(split_part(coalesce(assunto,''), '·', 3))) = 'resolvido');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_demanda_status_plantao
AFTER UPDATE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.sync_demanda_status_para_plantao();