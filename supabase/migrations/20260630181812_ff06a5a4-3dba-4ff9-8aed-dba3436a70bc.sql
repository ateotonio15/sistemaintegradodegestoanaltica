ALTER TABLE public.uber_corridas
  ADD COLUMN IF NOT EXISTS tem_reembolso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_reembolso numeric(12,2) NOT NULL DEFAULT 0;

UPDATE public.uber_corridas
  SET tem_reembolso = true, valor_reembolso = reembolso
  WHERE reembolso IS NOT NULL AND reembolso > 0 AND tem_reembolso = false;

CREATE OR REPLACE FUNCTION public.uber_corridas_sync_reembolso()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tem_reembolso IS NOT TRUE THEN
    NEW.valor_reembolso := 0;
  END IF;
  NEW.reembolso := COALESCE(NEW.valor_reembolso, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_uber_corridas_sync_reembolso ON public.uber_corridas;
CREATE TRIGGER trg_uber_corridas_sync_reembolso
BEFORE INSERT OR UPDATE ON public.uber_corridas
FOR EACH ROW EXECUTE FUNCTION public.uber_corridas_sync_reembolso();