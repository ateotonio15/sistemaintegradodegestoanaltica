CREATE TABLE public.palestras_saude_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  palestra_id uuid NOT NULL,
  data date NOT NULL,
  acao text NOT NULL CHECK (acao IN ('criada','editada','excluida')),
  dados jsonb NOT NULL,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.palestras_saude_historico TO authenticated;
GRANT ALL ON public.palestras_saude_historico TO service_role;
ALTER TABLE public.palestras_saude_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY palestras_hist_read ON public.palestras_saude_historico FOR SELECT TO authenticated USING (public.has_any_role(auth.uid()));
CREATE INDEX idx_palestras_hist_data ON public.palestras_saude_historico(data);

CREATE OR REPLACE FUNCTION public.log_palestras_saude()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nome text;
BEGIN
  SELECT display_name INTO v_nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.palestras_saude_historico(palestra_id, data, acao, dados, usuario_id, usuario_nome)
    VALUES (OLD.id, OLD.data, 'excluida', to_jsonb(OLD), auth.uid(), v_nome);
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.palestras_saude_historico(palestra_id, data, acao, dados, usuario_id, usuario_nome)
    VALUES (NEW.id, NEW.data, 'criada', to_jsonb(NEW), auth.uid(), coalesce(v_nome, NEW.criado_por));
    RETURN NEW;
  ELSE
    INSERT INTO public.palestras_saude_historico(palestra_id, data, acao, dados, usuario_id, usuario_nome)
    VALUES (NEW.id, NEW.data, 'editada', jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW)), auth.uid(), coalesce(v_nome, NEW.editado_por));
    RETURN NEW;
  END IF;
END $$;

CREATE TRIGGER trg_log_palestras_saude
AFTER INSERT OR UPDATE OR DELETE ON public.palestras_saude
FOR EACH ROW EXECUTE FUNCTION public.log_palestras_saude();