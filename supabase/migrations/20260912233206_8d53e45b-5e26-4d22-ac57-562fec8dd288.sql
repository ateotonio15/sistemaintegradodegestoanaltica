ALTER TABLE public.contrato_processo_pendencias
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'Outros',
  ADD COLUMN IF NOT EXISTS criticidade text NOT NULL DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Aberta',
  ADD COLUMN IF NOT EXISTS observacao_resolucao text;

UPDATE public.contrato_processo_pendencias
   SET titulo = COALESCE(titulo, left(descricao, 120)),
       status = CASE WHEN resolvida THEN 'Resolvida' ELSE 'Aberta' END;

ALTER TABLE public.contrato_processo_pendencias
  ALTER COLUMN titulo SET NOT NULL;

ALTER TABLE public.contrato_processo_pendencias
  DROP CONSTRAINT IF EXISTS pendencia_categoria_chk,
  DROP CONSTRAINT IF EXISTS pendencia_criticidade_chk,
  DROP CONSTRAINT IF EXISTS pendencia_status_chk;

ALTER TABLE public.contrato_processo_pendencias
  ADD CONSTRAINT pendencia_categoria_chk CHECK (categoria IN ('Jurídica','Cadastral','Financeira','Documental','Divergência de dados','Assinatura','Vigência','Elegibilidade','Outros')),
  ADD CONSTRAINT pendencia_criticidade_chk CHECK (criticidade IN ('Baixa','Média','Alta','Crítica')),
  ADD CONSTRAINT pendencia_status_chk CHECK (status IN ('Aberta','Em análise','Aguardando documento','Resolvida','Cancelada'));

-- mantém 'resolvida', datas e responsável coerentes com o status
CREATE OR REPLACE FUNCTION public.contrato_processo_pendencia_normalizar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_nome text;
BEGIN
  NEW.resolvida := NEW.status IN ('Resolvida','Cancelada');
  IF NEW.resolvida THEN
    IF NEW.resolvida_em IS NULL THEN NEW.resolvida_em := now(); END IF;
    IF NEW.resolvida_por IS NULL THEN NEW.resolvida_por := auth.uid(); END IF;
    IF NEW.resolvida_por_nome IS NULL AND NEW.resolvida_por IS NOT NULL THEN
      SELECT display_name INTO v_nome FROM public.profiles WHERE id = NEW.resolvida_por;
      NEW.resolvida_por_nome := v_nome;
    END IF;
  ELSE
    NEW.resolvida_em := NULL;
    NEW.resolvida_por := NULL;
    NEW.resolvida_por_nome := NULL;
    NEW.observacao_resolucao := NULL;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
    IF NEW.created_by_nome IS NULL AND NEW.created_by IS NOT NULL THEN
      SELECT display_name INTO v_nome FROM public.profiles WHERE id = NEW.created_by;
      NEW.created_by_nome := v_nome;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pendencia_normalizar ON public.contrato_processo_pendencias;
CREATE TRIGGER trg_pendencia_normalizar
BEFORE INSERT OR UPDATE ON public.contrato_processo_pendencias
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_pendencia_normalizar();

-- pendências nunca desaparecem
CREATE OR REPLACE FUNCTION public.contrato_processo_pendencia_bloquear_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Pendências não podem ser excluídas. Use o status Cancelada.';
END;
$$;

DROP TRIGGER IF EXISTS trg_pendencia_no_delete ON public.contrato_processo_pendencias;
CREATE TRIGGER trg_pendencia_no_delete
BEFORE DELETE ON public.contrato_processo_pendencias
FOR EACH ROW EXECUTE FUNCTION public.contrato_processo_pendencia_bloquear_delete();

REVOKE EXECUTE ON FUNCTION public.contrato_processo_pendencia_normalizar() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contrato_processo_pendencia_bloquear_delete() FROM anon, authenticated;
