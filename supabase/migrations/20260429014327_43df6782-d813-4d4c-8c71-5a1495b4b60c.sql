-- 1. Coluna dia_emissao em financeiro_movimentacoes
ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS dia_emissao smallint
    CHECK (dia_emissao IS NULL OR (dia_emissao BETWEEN 1 AND 31));

-- 2. Coluna aguardando_nota_em
ALTER TABLE public.financeiro_movimentacoes
  ADD COLUMN IF NOT EXISTS aguardando_nota_em timestamptz;

-- 3. Trigger BEFORE INSERT: default dia_emissao = 1 para periodos 20-25 e 25-30
CREATE OR REPLACE FUNCTION public.fin_set_default_dia_emissao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dia_emissao IS NULL AND NEW.periodo IN ('20-25','25-30') THEN
    NEW.dia_emissao := 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_set_default_dia_emissao ON public.financeiro_movimentacoes;
CREATE TRIGGER trg_fin_set_default_dia_emissao
BEFORE INSERT ON public.financeiro_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.fin_set_default_dia_emissao();

-- 4. Backfill
UPDATE public.financeiro_movimentacoes
   SET dia_emissao = 1
 WHERE dia_emissao IS NULL
   AND periodo IN ('20-25','25-30');

-- 5. Trigger em movimentacoes: ao preencher data_envio_financeiro,
-- marca aguardando_nota_em na movimentação financeira correspondente.
CREATE OR REPLACE FUNCTION public.fin_mark_aguardando_nota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE'
      AND NEW.data_envio_financeiro IS NOT NULL
      AND OLD.data_envio_financeiro IS DISTINCT FROM NEW.data_envio_financeiro)
     OR (TG_OP = 'INSERT' AND NEW.data_envio_financeiro IS NOT NULL) THEN
    UPDATE public.financeiro_movimentacoes
       SET aguardando_nota_em = now()
     WHERE empresa_id = NEW.empresa_id
       AND mes_referencia = NEW.mes_referencia
       AND periodo = NEW.periodo
       AND aguardando_nota_em IS NULL
       AND data_envio_nota IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_mark_aguardando_nota ON public.movimentacoes;
CREATE TRIGGER trg_fin_mark_aguardando_nota
AFTER INSERT OR UPDATE OF data_envio_financeiro ON public.movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.fin_mark_aguardando_nota();

-- 6. Backfill aguardando_nota_em a partir do histórico operacional
UPDATE public.financeiro_movimentacoes f
   SET aguardando_nota_em = COALESCE(m.updated_at, m.created_at)
  FROM public.movimentacoes m
 WHERE m.empresa_id = f.empresa_id
   AND m.mes_referencia = f.mes_referencia
   AND m.periodo = f.periodo
   AND m.data_envio_financeiro IS NOT NULL
   AND f.aguardando_nota_em IS NULL
   AND f.data_envio_nota IS NULL;