
CREATE OR REPLACE FUNCTION public.vincular_empresas_por_responsavel()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  empresa_record record;
  user_record record;
  primeiro_nome_empresa text;
  primeiro_nome_user text;
BEGIN
  FOR empresa_record IN SELECT id, responsavel_contrato FROM empresas WHERE responsavel_contrato IS NOT NULL LOOP
    primeiro_nome_empresa := lower(unaccent(split_part(trim(empresa_record.responsavel_contrato), ' ', 1)));

    IF primeiro_nome_empresa = '' THEN CONTINUE; END IF;

    FOR user_record IN SELECT user_id, display_name FROM profiles WHERE display_name IS NOT NULL LOOP
      primeiro_nome_user := lower(unaccent(split_part(trim(user_record.display_name), ' ', 1)));

      IF primeiro_nome_empresa = primeiro_nome_user THEN
        INSERT INTO empresa_usuarios (empresa_id, user_id)
        SELECT empresa_record.id, user_record.user_id
        WHERE NOT EXISTS (
          SELECT 1 FROM empresa_usuarios
          WHERE empresa_id = empresa_record.id AND user_id = user_record.user_id
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
