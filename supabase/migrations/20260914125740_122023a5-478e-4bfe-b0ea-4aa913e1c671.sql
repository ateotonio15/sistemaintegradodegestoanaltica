CREATE OR REPLACE FUNCTION public.get_avaliacao_envio_por_token(p_token text)
 RETURNS TABLE(id uuid, empresa_id uuid, empresa_nome text, executiva_nome text, data_resposta timestamp with time zone, formulario_id uuid, mes_referencia text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.empresa_id, e.empresa_nome,
         COALESCE(p.display_name, e.executiva_nome),
         e.data_resposta, e.formulario_id, e.mes_referencia
  FROM public.avaliacoes_envios e
  LEFT JOIN public.empresas emp ON emp.id = e.empresa_id
  LEFT JOIN public.profiles p ON p.user_id = emp.executiva_user_id
  WHERE e.token_unico = p_token
  LIMIT 1;
$function$;