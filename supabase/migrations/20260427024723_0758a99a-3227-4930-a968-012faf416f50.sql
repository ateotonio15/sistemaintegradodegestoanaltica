ALTER TABLE public.financeiro_movimentacoes
ADD COLUMN IF NOT EXISTS enviado_por_user_id uuid;