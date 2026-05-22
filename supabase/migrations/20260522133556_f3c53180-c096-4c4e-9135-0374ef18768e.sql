CREATE OR REPLACE FUNCTION public.trg_guard_boleto_dda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nota_emitida boolean;
BEGIN
  -- Se desmarcou DDA, garante limpeza dos campos de confirmação
  IF NEW.boleto_dda = false THEN
    NEW.boleto_confirmado_por := NULL;
    NEW.boleto_confirmado_em := NULL;
    RETURN NEW;
  END IF;

  -- Só validar quando boleto_dda está sendo ativado (false/null -> true) ou já era true
  IF NEW.boleto_dda = true
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.boleto_dda, false) = false) THEN

    v_nota_emitida := (NEW.data_envio_nota IS NOT NULL)
      OR EXISTS (
        SELECT 1
        FROM public.anexos_financeiro af
        WHERE af.financeiro_movimentacao_id = NEW.id
          AND (
            lower(coalesce(af.mime_type, '')) LIKE '%pdf%'
            OR lower(coalesce(af.nome_arquivo, '')) LIKE '%.pdf'
          )
      );

    IF NOT v_nota_emitida THEN
      RAISE EXCEPTION 'Boleto DDA só pode ser confirmado após a emissão da nota fiscal.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_boleto_dda ON public.financeiro_movimentacoes;
CREATE TRIGGER trg_guard_boleto_dda
BEFORE INSERT OR UPDATE OF boleto_dda, boleto_confirmado_por, boleto_confirmado_em
ON public.financeiro_movimentacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_boleto_dda();