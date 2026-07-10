-- Anexos vindos do fluxo Financeiro (NF/Faturamento) devem ser classificados como "Mensalidade"
-- por padrão, e não como "PDF Financeiro"/"Excel Financeiro".

CREATE OR REPLACE FUNCTION public.fin_arq_categoria_auto(_nome text, _mime text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Mensalidade'::text
$$;

-- Backfill: normaliza categorias antigas espelhadas do Financeiro para "Mensalidade"
UPDATE public.financeiro_arquivos
   SET categoria = 'Mensalidade', updated_at = now()
 WHERE status = 'ativo'
   AND origem = 'financeiro'
   AND categoria IN ('PDF Financeiro', 'Excel Financeiro', 'Outros');