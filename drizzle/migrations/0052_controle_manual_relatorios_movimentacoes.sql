CREATE TABLE public.movimentacao_relatorios (
 movimentacao_id uuid PRIMARY KEY REFERENCES public.movimentacoes(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'Não gerado' CHECK (status IN ('Não gerado','Gerando','Pronto para envio','Sem destinatário','Enviando','Enviado','Erro no envio','Conferido pela empresa','Divergência informada')),
 destinatarios text NOT NULL DEFAULT '',
 data_envio date,
 confirmacao text NOT NULL DEFAULT 'Aguardando' CHECK (confirmacao IN ('Aguardando','Conferido pela empresa','Divergência informada')),
 observacoes text NOT NULL DEFAULT '',
 atualizado_por uuid NOT NULL DEFAULT auth.uid(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.movimentacao_relatorios TO authenticated;
GRANT ALL ON public.movimentacao_relatorios TO service_role;
ALTER TABLE public.movimentacao_relatorios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura conforme movimentacao" ON public.movimentacao_relatorios FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE POLICY "Registro manual por gestores da movimentacao" ON public.movimentacao_relatorios FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE POLICY "Atualizacao manual por gestores da movimentacao" ON public.movimentacao_relatorios FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id)) WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'comum') OR public.has_role(auth.uid(), 'administradoras')) AND EXISTS (SELECT 1 FROM public.movimentacoes m WHERE m.id = movimentacao_id));
CREATE FUNCTION public.validar_movimentacao_relatorio() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.status IN ('Enviado','Conferido pela empresa','Divergência informada') OR NEW.confirmacao <> 'Aguardando' THEN
   IF NEW.data_envio IS NULL OR btrim(NEW.destinatarios) = '' THEN RAISE EXCEPTION 'Informe destinatários e data de envio'; END IF;
 END IF;
 IF NEW.confirmacao <> 'Aguardando' AND NEW.status <> NEW.confirmacao THEN RAISE EXCEPTION 'Confirmação incompatível com o status do relatório'; END IF;
 IF NEW.status IN ('Conferido pela empresa','Divergência informada') AND NEW.confirmacao <> NEW.status THEN RAISE EXCEPTION 'Confirmação incompatível com o status do relatório'; END IF;
 NEW.atualizado_por := auth.uid(); NEW.atualizado_em := now();
 RETURN NEW;
END $$;
CREATE TRIGGER validar_movimentacao_relatorio BEFORE INSERT OR UPDATE ON public.movimentacao_relatorios FOR EACH ROW EXECUTE FUNCTION public.validar_movimentacao_relatorio();