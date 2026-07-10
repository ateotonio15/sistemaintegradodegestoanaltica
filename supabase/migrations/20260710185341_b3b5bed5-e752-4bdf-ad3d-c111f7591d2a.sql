CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.set_lock_password(_lock_key text, _new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _username text;
BEGIN
  SELECT username INTO _username FROM public.profiles WHERE user_id = auth.uid();
  IF _username IS DISTINCT FROM 'adm.junior' THEN
    RAISE EXCEPTION 'Somente o usuário adm.junior pode definir esta senha';
  END IF;
  IF _new_password IS NULL OR length(_new_password) < 4 THEN
    RAISE EXCEPTION 'Senha muito curta';
  END IF;

  INSERT INTO public.security_locks (lock_key, password_hash, updated_by)
  VALUES (_lock_key, extensions.crypt(_new_password, extensions.gen_salt('bf', 10)), auth.uid())
  ON CONFLICT (lock_key) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_by = auth.uid(),
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_lock_password(_lock_key text, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _hash text;
BEGIN
  SELECT password_hash INTO _hash FROM public.security_locks WHERE lock_key = _lock_key;
  IF _hash IS NULL THEN RETURN false; END IF;
  RETURN extensions.crypt(_password, _hash) = _hash;
END;
$$;

REVOKE ALL ON FUNCTION public.set_lock_password(text, text) FROM public;
REVOKE ALL ON FUNCTION public.verify_lock_password(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_lock_password(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_lock_password(text, text) TO authenticated;