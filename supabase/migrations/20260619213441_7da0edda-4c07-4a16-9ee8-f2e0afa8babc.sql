
CREATE TABLE public.avaliacoes_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  email_destino text NOT NULL,
  data_envio timestamptz NOT NULL DEFAULT now(),
  data_resposta timestamptz,
  status text NOT NULL DEFAULT 'enviado',
  token_unico text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  formulario_id uuid REFERENCES public.cs_avaliacao_formularios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avaliacoes_envios TO authenticated;
GRANT SELECT, UPDATE ON public.avaliacoes_envios TO anon;
GRANT ALL ON public.avaliacoes_envios TO service_role;

ALTER TABLE public.avaliacoes_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler envios"
  ON public.avaliacoes_envios FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Autenticados podem criar envios"
  ON public.avaliacoes_envios FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar envios"
  ON public.avaliacoes_envios FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admin pode excluir envios"
  ON public.avaliacoes_envios FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Permite acesso público via token (para registrar resposta sem login)
CREATE POLICY "Acesso anônimo por token para leitura"
  ON public.avaliacoes_envios FOR SELECT
  TO anon USING (true);

CREATE POLICY "Acesso anônimo por token para atualizar resposta"
  ON public.avaliacoes_envios FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

CREATE TRIGGER trg_avaliacoes_envios_updated_at
  BEFORE UPDATE ON public.avaliacoes_envios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_avaliacoes_envios_empresa ON public.avaliacoes_envios(empresa_id);
CREATE INDEX idx_avaliacoes_envios_status ON public.avaliacoes_envios(status);
CREATE INDEX idx_avaliacoes_envios_token ON public.avaliacoes_envios(token_unico);
