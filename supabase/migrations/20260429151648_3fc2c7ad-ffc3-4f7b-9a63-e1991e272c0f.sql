-- Tabela isolada de pagadores (apenas contexto Financeiro)
CREATE TABLE public.financeiro_pagadores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  nome_pagador text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_financeiro_pagadores_empresa ON public.financeiro_pagadores(empresa_id);
CREATE UNIQUE INDEX uq_financeiro_pagadores_empresa_nome
  ON public.financeiro_pagadores(empresa_id, lower(nome_pagador));

ALTER TABLE public.financeiro_pagadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage financeiro_pagadores"
  ON public.financeiro_pagadores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Financeiro manage financeiro_pagadores"
  ON public.financeiro_pagadores
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'financeiro'::app_role))
  WITH CHECK (has_role(auth.uid(), 'financeiro'::app_role));

CREATE POLICY "Authenticated read financeiro_pagadores"
  ON public.financeiro_pagadores
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_financeiro_pagadores_updated_at
  BEFORE UPDATE ON public.financeiro_pagadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();