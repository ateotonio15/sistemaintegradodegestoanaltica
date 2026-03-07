INSERT INTO public.empresa_usuarios (empresa_id, user_id)
SELECT e.id, e.responsavel_user_id
FROM public.empresas e
WHERE e.responsavel_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = e.id AND eu.user_id = e.responsavel_user_id
  );