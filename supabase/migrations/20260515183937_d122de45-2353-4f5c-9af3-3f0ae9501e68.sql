
ALTER TABLE public.financeiro_analises
  ADD COLUMN IF NOT EXISTS pagador_id uuid;

CREATE INDEX IF NOT EXISTS financeiro_analises_pagador_idx
  ON public.financeiro_analises (financeiro_movimentacao_id, pagador_id);
