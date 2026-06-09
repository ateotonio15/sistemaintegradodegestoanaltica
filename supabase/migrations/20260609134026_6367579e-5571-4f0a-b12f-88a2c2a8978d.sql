
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS ultima_alteracao_user_id uuid,
  ADD COLUMN IF NOT EXISTS ultima_alteracao_nome text,
  ADD COLUMN IF NOT EXISTS ultima_alteracao_em timestamptz;

CREATE OR REPLACE FUNCTION public.trg_empresas_set_ultima_alteracao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = v_uid;
    NEW.ultima_alteracao_user_id := v_uid;
    NEW.ultima_alteracao_nome := COALESCE(v_nome, NEW.ultima_alteracao_nome);
    NEW.ultima_alteracao_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresas_set_ultima_alteracao ON public.empresas;
CREATE TRIGGER empresas_set_ultima_alteracao
BEFORE INSERT OR UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.trg_empresas_set_ultima_alteracao();
