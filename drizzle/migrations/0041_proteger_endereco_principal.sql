CREATE OR REPLACE FUNCTION public.proteger_empresa_endereco_principal()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE antigo jsonb; novo jsonb; tinha boolean; tem boolean;
BEGIN
  antigo := COALESCE(OLD.enderecos->'principal', '{}'::jsonb) || jsonb_build_object('endereco_legado', OLD.endereco);
  novo := COALESCE(NEW.enderecos->'principal', '{}'::jsonb) || jsonb_build_object('endereco_legado', NEW.endereco);
  SELECT EXISTS (SELECT 1 FROM jsonb_each_text(antigo) WHERE key NOT IN ('tipo','descricao_tipo') AND btrim(COALESCE(value,'')) <> '') INTO tinha;
  SELECT EXISTS (SELECT 1 FROM jsonb_each_text(novo) WHERE key NOT IN ('tipo','descricao_tipo') AND btrim(COALESCE(value,'')) <> '') INTO tem;
  IF tinha AND NOT tem THEN RAISE EXCEPTION 'O endereço principal não pode ser apagado. Informe o novo endereço.'; END IF;
  IF OLD.enderecos IS NOT NULL AND NEW.enderecos IS NULL THEN RAISE EXCEPTION 'Os endereços cadastrados não podem ser apagados silenciosamente.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER proteger_empresa_endereco_principal BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.proteger_empresa_endereco_principal();