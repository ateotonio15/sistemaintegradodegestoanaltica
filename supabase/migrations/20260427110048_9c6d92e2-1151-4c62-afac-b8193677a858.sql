-- Adicionar coluna tipo_financeiro em empresas (exclusiva da tela Financeiro)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tipo_financeiro text;

ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_tipo_financeiro_check;

ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_tipo_financeiro_check
  CHECK (tipo_financeiro IS NULL OR tipo_financeiro IN ('NÃO-PRORATA','INCLUSÃO','INCLUSÃO/EXCLUSÃO','TAXA ADESÃO'));

-- Trigger: ao alterar empresas.tipo_financeiro, propagar para movimentações financeiras
CREATE OR REPLACE FUNCTION public.sync_tipo_cobranca_from_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo_financeiro IS DISTINCT FROM OLD.tipo_financeiro AND NEW.tipo_financeiro IS NOT NULL THEN
    UPDATE public.financeiro_movimentacoes
       SET tipo_cobranca = NEW.tipo_financeiro
     WHERE empresa_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tipo_cobranca_from_empresa ON public.empresas;
CREATE TRIGGER trg_sync_tipo_cobranca_from_empresa
AFTER UPDATE OF tipo_financeiro ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.sync_tipo_cobranca_from_empresa();

-- Trigger: ao criar uma nova movimentação financeira, herdar o tipo_financeiro da empresa
CREATE OR REPLACE FUNCTION public.set_tipo_cobranca_from_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tipo text;
BEGIN
  IF NEW.tipo_cobranca IS NULL THEN
    SELECT tipo_financeiro INTO v_tipo FROM public.empresas WHERE id = NEW.empresa_id;
    IF v_tipo IS NOT NULL THEN
      NEW.tipo_cobranca := v_tipo;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tipo_cobranca_from_empresa ON public.financeiro_movimentacoes;
CREATE TRIGGER trg_set_tipo_cobranca_from_empresa
BEFORE INSERT ON public.financeiro_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.set_tipo_cobranca_from_empresa();