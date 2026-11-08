CREATE TABLE public.produtos_planos (
 codigo_produto integer PRIMARY KEY,
 nome_produto text NOT NULL,
 acomodacao text NOT NULL DEFAULT 'Não definida' CHECK (acomodacao IN ('Enfermaria','Apartamento','Não definida')),
 ativo boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.produtos_planos TO authenticated;
GRANT ALL ON public.produtos_planos TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.produtos_planos TO authenticated;
ALTER TABLE public.produtos_planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo leitura autenticada" ON public.produtos_planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catalogo gestao admin" ON public.produtos_planos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.empresas ADD COLUMN produto_enfermaria_codigo integer REFERENCES public.produtos_planos(codigo_produto), ADD COLUMN produto_apartamento_codigo integer REFERENCES public.produtos_planos(codigo_produto), ADD COLUMN produto_nao_definido_codigo integer REFERENCES public.produtos_planos(codigo_produto);
COMMENT ON COLUMN public.empresas.plano IS 'Plano legado preservado; novos vínculos comerciais usam produto_enfermaria_codigo, produto_apartamento_codigo e produto_nao_definido_codigo.';
CREATE FUNCTION public.validar_produtos_empresa() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.produto_enfermaria_codigo IS DISTINCT FROM OLD.produto_enfermaria_codigo OR TG_OP='INSERT' THEN
  IF NEW.produto_enfermaria_codigo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtos_planos WHERE codigo_produto=NEW.produto_enfermaria_codigo AND acomodacao='Enfermaria' AND ativo) THEN RAISE EXCEPTION 'Produto de Enfermaria inválido'; END IF;
 END IF;
 IF NEW.produto_apartamento_codigo IS DISTINCT FROM OLD.produto_apartamento_codigo OR TG_OP='INSERT' THEN
  IF NEW.produto_apartamento_codigo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtos_planos WHERE codigo_produto=NEW.produto_apartamento_codigo AND acomodacao='Apartamento' AND ativo) THEN RAISE EXCEPTION 'Produto de Apartamento inválido'; END IF;
 END IF;
 IF NEW.produto_nao_definido_codigo IS DISTINCT FROM OLD.produto_nao_definido_codigo OR TG_OP='INSERT' THEN
  IF NEW.produto_nao_definido_codigo IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.produtos_planos WHERE codigo_produto=NEW.produto_nao_definido_codigo AND acomodacao='Não definida' AND ativo) THEN RAISE EXCEPTION 'Produto sem acomodação inválido'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validar_produtos_empresa BEFORE INSERT OR UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.validar_produtos_empresa();