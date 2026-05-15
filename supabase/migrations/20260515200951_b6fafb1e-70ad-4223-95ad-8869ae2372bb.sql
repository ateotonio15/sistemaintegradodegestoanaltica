
-- 1) Novos campos em financeiro_arquivos
ALTER TABLE public.financeiro_arquivos
  ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'arquivos-financeiro',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual_arquivos',
  ADD COLUMN IF NOT EXISTS anexo_financeiro_id uuid,
  ADD COLUMN IF NOT EXISTS financeiro_movimentacao_id uuid;

CREATE INDEX IF NOT EXISTS idx_fin_arq_anexo ON public.financeiro_arquivos(anexo_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_fin_arq_origem ON public.financeiro_arquivos(origem);
CREATE INDEX IF NOT EXISTS idx_fin_arq_storage ON public.financeiro_arquivos(storage_path);

-- 2) Função: categoria automática a partir de extensão/mime
CREATE OR REPLACE FUNCTION public.fin_arq_categoria_auto(_nome text, _mime text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(_nome,'')) ~ '\.(xlsx|xls|csv)$' OR coalesce(_mime,'') ILIKE '%spreadsheet%' OR coalesce(_mime,'') ILIKE '%excel%' OR coalesce(_mime,'') = 'text/csv'
      THEN 'Excel Financeiro'
    WHEN lower(coalesce(_nome,'')) ~ '\.pdf$' OR coalesce(_mime,'') = 'application/pdf'
      THEN 'PDF Financeiro'
    WHEN lower(coalesce(_nome,'')) ~ '\.(png|jpg|jpeg|webp|gif)$' OR coalesce(_mime,'') ILIKE 'image/%'
      THEN 'Comprovantes'
    ELSE 'Outros'
  END
$$;

-- 3) Trigger AFTER INSERT em anexos_financeiro -> espelha em financeiro_arquivos
CREATE OR REPLACE FUNCTION public.sync_financeiro_arquivos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp uuid;
  v_comp text;
  v_ext text;
  v_uname text;
BEGIN
  -- empresa + competência via movimentação financeira
  SELECT fm.empresa_id, fm.mes_referencia
    INTO v_emp, v_comp
  FROM public.financeiro_movimentacoes fm
  WHERE fm.id = NEW.financeiro_movimentacao_id;

  IF v_emp IS NULL OR v_comp IS NULL THEN
    RETURN NEW;
  END IF;

  -- evita duplicidade (mesmo objeto já espelhado e ativo)
  IF EXISTS (
    SELECT 1 FROM public.financeiro_arquivos
    WHERE storage_path = NEW.storage_path
      AND status = 'ativo'
  ) THEN
    RETURN NEW;
  END IF;

  v_ext := lower(regexp_replace(coalesce(NEW.nome_arquivo,''), '^.*\.([^.]+)$', '\1'));
  IF v_ext = coalesce(NEW.nome_arquivo,'') THEN v_ext := NULL; END IF;

  SELECT display_name INTO v_uname FROM public.profiles WHERE user_id = NEW.uploaded_by;

  INSERT INTO public.financeiro_arquivos (
    empresa_id, competencia, categoria,
    nome_original, nome_armazenado, extensao, mime_type, tamanho_bytes,
    storage_path, status, versao,
    uploaded_by, uploaded_by_nome,
    bucket, origem, anexo_financeiro_id, financeiro_movimentacao_id
  ) VALUES (
    v_emp, v_comp, public.fin_arq_categoria_auto(NEW.nome_arquivo, NEW.mime_type),
    NEW.nome_arquivo,
    regexp_replace(NEW.storage_path, '^.*/', ''),
    v_ext, NEW.mime_type, NEW.tamanho_bytes,
    NEW.storage_path, 'ativo', 1,
    NEW.uploaded_by, v_uname,
    'anexos-financeiro', 'financeiro', NEW.id, NEW.financeiro_movimentacao_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fin_arq_ins ON public.anexos_financeiro;
CREATE TRIGGER trg_sync_fin_arq_ins
AFTER INSERT ON public.anexos_financeiro
FOR EACH ROW
EXECUTE FUNCTION public.sync_financeiro_arquivos_insert();

-- 4) Trigger AFTER DELETE em anexos_financeiro -> remove do espelho
CREATE OR REPLACE FUNCTION public.sync_financeiro_arquivos_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- marca como removido apenas se não houver outra referência ativa ao mesmo storage_path
  IF NOT EXISTS (
    SELECT 1 FROM public.anexos_financeiro
    WHERE storage_path = OLD.storage_path
  ) THEN
    UPDATE public.financeiro_arquivos
       SET status = 'removido', updated_at = now()
     WHERE storage_path = OLD.storage_path
       AND origem = 'financeiro'
       AND status = 'ativo';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_fin_arq_del ON public.anexos_financeiro;
CREATE TRIGGER trg_sync_fin_arq_del
AFTER DELETE ON public.anexos_financeiro
FOR EACH ROW
EXECUTE FUNCTION public.sync_financeiro_arquivos_delete();

-- 5) Backfill: importa anexos_financeiro existentes para financeiro_arquivos
INSERT INTO public.financeiro_arquivos (
  empresa_id, competencia, categoria,
  nome_original, nome_armazenado, extensao, mime_type, tamanho_bytes,
  storage_path, status, versao,
  uploaded_by, uploaded_by_nome,
  bucket, origem, anexo_financeiro_id, financeiro_movimentacao_id, created_at
)
SELECT
  fm.empresa_id,
  fm.mes_referencia,
  public.fin_arq_categoria_auto(af.nome_arquivo, af.mime_type),
  af.nome_arquivo,
  regexp_replace(af.storage_path, '^.*/', ''),
  NULLIF(lower(regexp_replace(coalesce(af.nome_arquivo,''), '^.*\.([^.]+)$', '\1')), coalesce(af.nome_arquivo,'')),
  af.mime_type,
  af.tamanho_bytes,
  af.storage_path,
  'ativo', 1,
  af.uploaded_by,
  (SELECT display_name FROM public.profiles p WHERE p.user_id = af.uploaded_by),
  'anexos-financeiro', 'financeiro', af.id, af.financeiro_movimentacao_id,
  af.created_at
FROM public.anexos_financeiro af
JOIN public.financeiro_movimentacoes fm ON fm.id = af.financeiro_movimentacao_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.financeiro_arquivos fa
  WHERE fa.storage_path = af.storage_path AND fa.status = 'ativo'
);
