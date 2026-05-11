-- Anexar triggers ausentes em reajustes_anuais
DROP TRIGGER IF EXISTS trg_reajuste_calc_campos ON public.reajustes_anuais;
CREATE TRIGGER trg_reajuste_calc_campos
  BEFORE INSERT OR UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_reajuste_calc_campos();

DROP TRIGGER IF EXISTS trg_guard_reajuste_comum ON public.reajustes_anuais;
CREATE TRIGGER trg_guard_reajuste_comum
  BEFORE UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.guard_reajuste_comum();

DROP TRIGGER IF EXISTS trg_criar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_criar_alerta_reajuste
  AFTER INSERT ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_criar_alerta_reajuste();

DROP TRIGGER IF EXISTS trg_finalizar_alerta_reajuste ON public.reajustes_anuais;
CREATE TRIGGER trg_finalizar_alerta_reajuste
  AFTER UPDATE ON public.reajustes_anuais
  FOR EACH ROW EXECUTE FUNCTION public.trg_finalizar_alerta_reajuste();

-- Backfill: dispara recálculo via UPDATE (BEFORE UPDATE recalcula tudo)
UPDATE public.reajustes_anuais
   SET updated_at = now()
 WHERE valor_antigo_centavos IS NOT NULL;