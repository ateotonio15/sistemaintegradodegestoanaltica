-- Corrige a data da demanda de ALAN BARBOSA TELES (ano 82026 → 2026)
UPDATE public.demandas
SET data_reclamacao = DATE '2026-06-26'
WHERE id = 'c49cdbbf-3e7d-4a79-8bd3-2e79c8792b1e';

-- Impede novas datas fora de um intervalo plausível (anos 2000-2100)
CREATE OR REPLACE FUNCTION public.demanda_valida_data_reclamacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_reclamacao IS NOT NULL AND
     (EXTRACT(YEAR FROM NEW.data_reclamacao) < 2000
      OR EXTRACT(YEAR FROM NEW.data_reclamacao) > 2100) THEN
    RAISE EXCEPTION 'Data da reclamação inválida: %', NEW.data_reclamacao;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_demanda_valida_data ON public.demandas;
CREATE TRIGGER trg_demanda_valida_data
BEFORE INSERT OR UPDATE ON public.demandas
FOR EACH ROW EXECUTE FUNCTION public.demanda_valida_data_reclamacao();