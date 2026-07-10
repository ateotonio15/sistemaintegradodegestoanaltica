CREATE OR REPLACE FUNCTION public.set_lock_password(_lock_key text, _new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uname text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT username INTO _uname
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF _uname IS DISTINCT FROM 'adm.junior' THEN
    RAISE EXCEPTION 'Apenas o usuário adm.junior pode definir esta senha';
  END IF;

  IF _new_password IS NULL OR length(_new_password) < 4 THEN
    RAISE EXCEPTION 'Senha inválida (mínimo 4 caracteres)';
  END IF;

  INSERT INTO public.security_locks (lock_key, password_hash, updated_by, updated_at)
  VALUES (_lock_key, crypt(_new_password, gen_salt('bf', 10)), auth.uid(), now())
  ON CONFLICT (lock_key) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        updated_by    = EXCLUDED.updated_by,
        updated_at    = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_lock_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lock_password(text, text) TO authenticated;