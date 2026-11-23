CREATE TABLE public.email_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  cenario text NOT NULL,
  destino text NOT NULL DEFAULT 'Empresa',
  assunto text NOT NULL,
  corpo text NOT NULL,
  anexos_esperados text[] NOT NULL DEFAULT '{}',
  cc_padrao text,
  assinatura_tipo text NOT NULL DEFAULT 'padrao',
  assinatura_texto text,
  status text NOT NULL DEFAULT 'ativo',
  versao integer NOT NULL DEFAULT 1,
  utilizado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid,
  criado_por_nome text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  atualizado_por_nome text
);
CREATE TABLE public.email_modelo_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id uuid NOT NULL REFERENCES public.email_modelos(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  dados jsonb NOT NULL,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  alterado_por uuid,
  alterado_por_nome text,
  UNIQUE (modelo_id, versao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_modelos TO authenticated;
GRANT SELECT ON public.email_modelo_versoes TO authenticated;
GRANT ALL ON public.email_modelos TO service_role;
GRANT ALL ON public.email_modelo_versoes TO service_role;

CREATE OR REPLACE FUNCTION public.email_modelo_versionar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text;
BEGIN
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = auth.uid();
  IF TG_OP = 'INSERT' THEN
    NEW.versao := 1; NEW.utilizado := false;
    NEW.criado_por := auth.uid(); NEW.criado_por_nome := v_nome; NEW.criado_em := now();
  ELSE
    NEW.criado_por := OLD.criado_por; NEW.criado_por_nome := OLD.criado_por_nome; NEW.criado_em := OLD.criado_em;
    IF auth.uid() IS NOT NULL THEN NEW.utilizado := OLD.utilizado; END IF;
    IF (NEW.nome, NEW.descricao, NEW.cenario, NEW.destino, NEW.assunto, NEW.corpo, NEW.anexos_esperados, NEW.cc_padrao, NEW.assinatura_tipo, NEW.assinatura_texto, NEW.status)
       IS NOT DISTINCT FROM (OLD.nome, OLD.descricao, OLD.cenario, OLD.destino, OLD.assunto, OLD.corpo, OLD.anexos_esperados, OLD.cc_padrao, OLD.assinatura_tipo, OLD.assinatura_texto, OLD.status) THEN
      NEW.versao := OLD.versao; RETURN NEW;
    END IF;
    NEW.versao := OLD.versao + 1;
  END IF;
  NEW.atualizado_em := now(); NEW.atualizado_por := auth.uid(); NEW.atualizado_por_nome := v_nome;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.email_modelo_gravar_versao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.email_modelo_versoes (modelo_id, versao, dados, alterado_em, alterado_por, alterado_por_nome)
  VALUES (NEW.id, NEW.versao, to_jsonb(NEW) - 'utilizado', NEW.atualizado_em, NEW.atualizado_por, NEW.atualizado_por_nome)
  ON CONFLICT (modelo_id, versao) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_email_modelo_versionar BEFORE INSERT OR UPDATE ON public.email_modelos FOR EACH ROW EXECUTE FUNCTION public.email_modelo_versionar();
CREATE TRIGGER trg_email_modelo_gravar_versao AFTER INSERT OR UPDATE ON public.email_modelos FOR EACH ROW EXECUTE FUNCTION public.email_modelo_gravar_versao();

ALTER TABLE public.email_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_modelo_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ler modelos" ON public.email_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Criar modelos" ON public.email_modelos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));
CREATE POLICY "Editar modelos" ON public.email_modelos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')) WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum'));
CREATE POLICY "Excluir modelos nunca usados" ON public.email_modelos FOR DELETE TO authenticated USING (NOT utilizado AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comum')));
CREATE POLICY "Ler versões" ON public.email_modelo_versoes FOR SELECT TO authenticated USING (true);