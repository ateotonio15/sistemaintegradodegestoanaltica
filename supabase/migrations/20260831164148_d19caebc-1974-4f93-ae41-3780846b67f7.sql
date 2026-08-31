CREATE OR REPLACE FUNCTION public.dashboard_movimentacoes(p_mes_ini text, p_mes_fim text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, empresa_id uuid, mes_referencia text, periodo text, data_envio_empresa date, data_envio_financeiro date, empresa_nome text, tipo_movimentacao text, responsavel_contrato text, responsavel_user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, m.empresa_id, m.mes_referencia, m.periodo,
         m.data_envio_empresa, m.data_envio_financeiro,
         e.nome, e.tipo_movimentacao, e.responsavel_contrato, e.responsavel_user_id
  from public.movimentacoes m
  join public.empresas e on e.id = m.empresa_id
  where e.tipo_contrato = 'EMPRESARIAL'
    and m.mes_referencia >= p_mes_ini
    and (p_mes_fim is null or m.mes_referencia <= p_mes_fim)
    and (
      e.status_empresa = 'Ativa'
      or (e.data_rescisao is not null and m.mes_referencia <= to_char(e.data_rescisao, 'YYYY-MM'))
    )
    and auth.uid() is not null
$function$;