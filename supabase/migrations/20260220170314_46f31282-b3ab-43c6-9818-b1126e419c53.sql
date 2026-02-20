
-- Tabela de empresas
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  responsavel_contrato TEXT,
  operadora_plano TEXT,
  data_corte INTEGER,
  dia_movimentacao INTEGER,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de movimentações
CREATE TABLE public.movimentacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes_referencia TEXT NOT NULL,
  periodo TEXT NOT NULL,
  data_envio_empresa DATE,
  data_retorno_empresa DATE,
  data_envio_financeiro DATE,
  responsavel_movimentacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: Como não há autenticação, permitir acesso público a ambas as tabelas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to empresas" ON public.empresas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to movimentacoes" ON public.movimentacoes FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_movimentacoes_updated_at BEFORE UPDATE ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index para buscas
CREATE INDEX idx_movimentacoes_empresa_id ON public.movimentacoes(empresa_id);
CREATE INDEX idx_movimentacoes_mes_referencia ON public.movimentacoes(mes_referencia);
CREATE INDEX idx_movimentacoes_periodo ON public.movimentacoes(periodo);
