CREATE OR REPLACE FUNCTION public.validar_produtos_empresa() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.produto_enfermaria_codigo IS DISTINCT FROM OLD.produto_enfermaria_codigo THEN
  IF NEW.produto_enfermaria_codigo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtos_planos WHERE codigo_produto=NEW.produto_enfermaria_codigo AND ativo) THEN RAISE EXCEPTION 'Produto de Enfermaria inválido'; END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.produto_apartamento_codigo IS DISTINCT FROM OLD.produto_apartamento_codigo THEN
  IF NEW.produto_apartamento_codigo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtos_planos WHERE codigo_produto=NEW.produto_apartamento_codigo AND ativo) THEN RAISE EXCEPTION 'Produto de Apartamento inválido'; END IF;
 END IF;
 RETURN NEW;
END $$;
COMMENT ON COLUMN public.empresas.produto_nao_definido_codigo IS 'DEPRECATED: terceiro vínculo retirado da interface; dados históricos preservados. Usar os vínculos manuais produto_enfermaria_codigo e produto_apartamento_codigo.';