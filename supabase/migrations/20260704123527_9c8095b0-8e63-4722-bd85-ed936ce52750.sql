-- 1) Atualiza trigger de espelhamento para respeitar a origem
CREATE OR REPLACE FUNCTION public.sync_financeiro_arquivos_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp uuid;
  v_comp text;
  v_ext text;
  v_uname text;
  v_categoria text;
BEGIN
  SELECT fm.empresa_id, fm.mes_referencia
    INTO v_emp, v_comp
  FROM public.financeiro_movimentacoes fm
  WHERE fm.id = NEW.financeiro_movimentacao_id;

  IF v_emp IS NULL OR v_comp IS NULL THEN
    RETURN NEW;
  END IF;

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

  v_categoria := CASE
    WHEN NEW.origem = 'reajuste'   THEN 'Reajuste'
    WHEN NEW.origem = 'retroativo' THEN 'Retroativo'
    ELSE public.fin_arq_categoria_auto(NEW.nome_arquivo, NEW.mime_type)
  END;

  INSERT INTO public.financeiro_arquivos (
    empresa_id, competencia, categoria,
    nome_original, nome_armazenado, extensao, mime_type, tamanho_bytes,
    storage_path, status, versao,
    uploaded_by, uploaded_by_nome,
    bucket, origem, anexo_financeiro_id, financeiro_movimentacao_id
  ) VALUES (
    v_emp, v_comp, v_categoria,
    NEW.nome_arquivo,
    regexp_replace(NEW.storage_path, '^.*/', ''),
    v_ext, NEW.mime_type, NEW.tamanho_bytes,
    NEW.storage_path, 'ativo', 1,
    NEW.uploaded_by, v_uname,
    'anexos-financeiro', 'financeiro', NEW.id, NEW.financeiro_movimentacao_id
  );

  RETURN NEW;
END;
$function$;

-- 2) Backfill: anexos ligados a REAJUSTES existentes -> "Reajuste"
UPDATE public.financeiro_arquivos fa
SET categoria = 'Reajuste'
FROM public.reajustes r
WHERE fa.financeiro_movimentacao_id = r.financeiro_movimentacao_id
  AND fa.status = 'ativo'
  AND fa.origem = 'financeiro'
  AND fa.categoria <> 'Reajuste';

-- 3) Backfill: anexos ligados a COBRANÇAS RETROATIVAS existentes -> "Retroativo"
UPDATE public.financeiro_arquivos fa
SET categoria = 'Retroativo'
FROM public.cobrancas_retroativas c
WHERE fa.financeiro_movimentacao_id = c.financeiro_movimentacao_id
  AND fa.status = 'ativo'
  AND fa.origem = 'financeiro'
  AND fa.categoria NOT IN ('Reajuste','Retroativo');