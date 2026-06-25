UPDATE public.painel_tv_meta_diaria
SET empresas_snapshot = (
  SELECT to_jsonb(array_agg(DISTINCT x))
  FROM (
    SELECT jsonb_array_elements_text(empresas_snapshot) AS x
    UNION
    SELECT '8cd78573-7d38-4338-804d-f517bd92c08a'
  ) s
),
updated_at = now()
WHERE data = '2026-06-25';