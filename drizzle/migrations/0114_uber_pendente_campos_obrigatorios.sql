CREATE OR REPLACE FUNCTION public.uber_importacao_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.uber_trip_id IS DISTINCT FROM OLD.uber_trip_id OR NEW.importacao_id IS DISTINCT FROM OLD.importacao_id OR NEW.setor_solicitante IS DISTINCT FROM OLD.setor_solicitante) THEN RAISE EXCEPTION 'Identidade da importação não pode ser alterada'; END IF;
 IF NEW.importacao_id IS NOT NULL THEN
  IF TG_OP='INSERT' AND current_user IN ('authenticated','anon') THEN RAISE EXCEPTION 'Use a confirmação de importação'; END IF;
  NEW.status_importacao := CASE WHEN nullif(trim(NEW.colaborador),'') IS NULL OR nullif(trim(NEW.empresa),'') IS NULL OR nullif(trim(NEW.motivo),'') IS NULL OR nullif(trim(NEW.tipo),'') IS NULL THEN 'pendente' ELSE 'completa' END;
 END IF;
 RETURN NEW;
END $$;