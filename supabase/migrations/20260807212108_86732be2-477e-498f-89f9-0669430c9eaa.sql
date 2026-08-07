create or replace function public.dashboard_movimentacoes(p_mes_ini text, p_mes_fim text default null)
returns table(
  id uuid,
  empresa_id uuid,
  mes_referencia text,
  periodo text,
  data_envio_empresa date,
  data_envio_financeiro date,
  empresa_nome text,
  tipo_movimentacao text,
  responsavel_contrato text,
  responsavel_user_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.empresa_id, m.mes_referencia, m.periodo,
         m.data_envio_empresa, m.data_envio_financeiro,
         e.nome, e.tipo_movimentacao, e.responsavel_contrato, e.responsavel_user_id
  from public.movimentacoes m
  join public.empresas e on e.id = m.empresa_id
  where e.tipo_contrato = 'EMPRESARIAL'
    and m.mes_referencia >= p_mes_ini
    and (p_mes_fim is null or m.mes_referencia <= p_mes_fim)
    and auth.uid() is not null
$$;

grant execute on function public.dashboard_movimentacoes(text, text) to authenticated;