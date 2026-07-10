
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.security_locks (
  lock_key text PRIMARY KEY,
  password_hash text NOT NULL,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.security_locks TO authenticated;
GRANT ALL ON public.security_locks TO service_role;

ALTER TABLE public.security_locks ENABLE ROW LEVEL SECURITY;

-- Ninguém pode inserir/atualizar/deletar diretamente. Só via RPC SECURITY DEFINER.
CREATE POLICY "Ler status do cadeado (autenticado)"
  ON public.security_locks FOR SELECT TO authenticated
  USING (true);

-- Função: apenas adm.junior pode definir/alterar a senha do cadeado.
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

  SELECT username INTO _uname FROM public.profiles WHERE id = auth.uid();

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

-- Função: qualquer autenticado pode verificar a senha (retorna true/false).
CREATE OR REPLACE FUNCTION public.verify_lock_password(_lock_key text, _password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT password_hash INTO _hash FROM public.security_locks WHERE lock_key = _lock_key;
  IF _hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN _hash = crypt(_password, _hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_lock_password(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_lock_password(text, text) TO authenticated;
