ALTER TABLE public.empresas ADD COLUMN enderecos jsonb;
COMMENT ON COLUMN public.empresas.enderecos IS 'Single principal object and secondary address array. Legacy endereco remains preserved and compatible.';
CREATE OR REPLACE FUNCTION public.validar_empresa_enderecos()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb;
BEGIN
  IF NEW.enderecos IS NOT NULL THEN
    IF jsonb_typeof(NEW.enderecos) IS DISTINCT FROM 'object'
       OR jsonb_typeof(NEW.enderecos->'principal') IS DISTINCT FROM 'object'
       OR NEW.enderecos->'principal'->>'tipo' IS DISTINCT FROM 'Principal'
       OR jsonb_typeof(NEW.enderecos->'secundarios') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Informe um único endereço principal e uma lista de endereços secundários';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.enderecos->'secundarios') LOOP
      IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR COALESCE(item->>'tipo','') NOT IN ('Filial','Unidade','Administrativo','Financeiro','Correspondência','Outro') THEN
        RAISE EXCEPTION 'Tipo de endereço secundário inválido';
      END IF;
      IF item->>'tipo' = 'Outro' AND btrim(COALESCE(item->>'descricao_tipo','')) = '' THEN
        RAISE EXCEPTION 'Informe a descrição do tipo Outro';
      END IF;
    END LOOP;
    IF TG_OP = 'UPDATE' AND NEW.enderecos IS NOT DISTINCT FROM OLD.enderecos AND NEW.endereco IS DISTINCT FROM OLD.endereco THEN
      NEW.enderecos := jsonb_set(NEW.enderecos, '{principal,endereco_livre}', to_jsonb(COALESCE(NEW.endereco,'')));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validar_empresa_enderecos BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.validar_empresa_enderecos();