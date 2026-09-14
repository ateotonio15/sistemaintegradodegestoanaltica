CREATE OR REPLACE FUNCTION public.get_avaliacao_formulario_por_token(p_token text)
 RETURNS TABLE(id uuid, titulo text, tipo text, instrucoes text, perguntas jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH env AS (
    SELECT e.formulario_id
    FROM public.avaliacoes_envios e
    WHERE e.token_unico = p_token
    LIMIT 1
  ),
  fid AS (
    SELECT COALESCE(
      (SELECT formulario_id FROM env),
      (SELECT id FROM public.cs_avaliacao_formularios
       WHERE tipo = 'rh' ORDER BY created_at DESC LIMIT 1)
    ) AS id
    WHERE EXISTS (SELECT 1 FROM env)
  )
  SELECT f.id, f.titulo, f.tipo, f.instrucoes, f.perguntas
  FROM public.cs_avaliacao_formularios f
  JOIN fid ON fid.id = f.id;
$function$;
