
CREATE OR REPLACE FUNCTION public.sync_empresa_responsavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Remove old links for this empresa (only the responsavel-based one)
  IF TG_OP = 'UPDATE' AND OLD.responsavel_user_id IS DISTINCT FROM NEW.responsavel_user_id THEN
    IF OLD.responsavel_user_id IS NOT NULL THEN
      DELETE FROM public.empresa_usuarios
      WHERE empresa_id = NEW.id AND user_id = OLD.responsavel_user_id;
    END IF;
  END IF;

  -- Insert new link if responsavel_user_id is set
  IF NEW.responsavel_user_id IS NOT NULL THEN
    INSERT INTO public.empresa_usuarios (empresa_id, user_id)
    VALUES (NEW.id, NEW.responsavel_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_empresa_responsavel ON public.empresas;

CREATE TRIGGER trg_sync_empresa_responsavel
AFTER INSERT OR UPDATE ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.sync_empresa_responsavel();
