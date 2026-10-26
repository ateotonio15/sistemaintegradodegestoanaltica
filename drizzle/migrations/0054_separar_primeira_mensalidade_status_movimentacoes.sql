CREATE OR REPLACE FUNCTION public.status_faturamento_competencia(p_mes text)
RETURNS TABLE (empresa_id uuid, periodo text, status text, faturamento_por text, data_envio_nota date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
begin
  if auth.uid() is null then
    return;
  end if;
  return query
  with fm as (
    select f.id, f.empresa_id, f.mes_referencia, f.periodo,
           f.data_envio_nota, f.dentro_prazo, f.faturamento_iniciado_em,
           f.faturamento_iniciado_por_nome,
           coalesce(e.exige_po_pc, false) as exige_po_pc,
           gc.grupo_id
    from financeiro_movimentacoes f
    left join empresas e on e.id = f.empresa_id
    left join grupos_financeiros_contratos gc
      on gc.empresa_id = f.empresa_id and gc.ativo = true
    where f.mes_referencia = p_mes
      and coalesce(f.tipo_lancamento, 'normal') = 'normal'
  ),
  anexos as (
    select a.financeiro_movimentacao_id as mov_id,
           a.mime_type, a.nome_arquivo, coalesce(a.origem, 'normal') as origem
    from anexos_financeiro a
    where a.financeiro_movimentacao_id in (select id from fm)
  ),
  anexos_validos as (
    select an.*, fm.empresa_id, fm.mes_referencia, fm.periodo, fm.grupo_id
    from anexos an
    join fm on fm.id = an.mov_id
    where lower(an.origem) not in ('retroativo', 'reajuste')
  ),
  flags as (
    select fm.id,
      exists (
        select 1 from anexos_validos av
        where (av.mov_id = fm.id
               or (fm.grupo_id is not null and av.grupo_id = fm.grupo_id
                   and av.mes_referencia = fm.mes_referencia and av.periodo = fm.periodo))
          and (lower(coalesce(av.mime_type, '')) like '%pdf%'
               or lower(coalesce(av.nome_arquivo, '')) like '%.pdf')
      ) as tem_pdf,
      exists (
        select 1 from anexos_validos av
        where (av.mov_id = fm.id
               or (fm.grupo_id is not null and av.grupo_id = fm.grupo_id
                   and av.mes_referencia = fm.mes_referencia and av.periodo = fm.periodo))
          and (lower(coalesce(av.mime_type, '')) like '%spreadsheet%'
               or lower(coalesce(av.mime_type, '')) like '%excel%'
               or lower(coalesce(av.mime_type, '')) = 'text/csv'
               or lower(coalesce(av.nome_arquivo, '')) like '%.xlsx'
               or lower(coalesce(av.nome_arquivo, '')) like '%.xls'
               or lower(coalesce(av.nome_arquivo, '')) like '%.csv')
      ) as tem_xls
    from fm
  ),
  envio as (
    select distinct m.empresa_id, m.periodo
    from movimentacoes m
    where m.mes_referencia = p_mes and m.data_envio_financeiro is not null
  ),
  calc as (
    select fm.empresa_id, fm.periodo,
      case
        when fm.data_envio_nota is not null then 'Enviada'
        when fl.tem_pdf then 'Nota emitida'
        when fl.tem_xls and fm.exige_po_pc then 'Aguardando validação'
        when fl.tem_xls then 'Faturado'
        when fm.faturamento_iniciado_em is not null then 'Em faturamento'
        when fm.dentro_prazo = false then 'Fora do prazo'
        when exists (select 1 from envio en where en.empresa_id = fm.empresa_id and en.periodo = fm.periodo) then 'Aguardando nota'
        else 'Pendente'
      end as status,
      fm.faturamento_iniciado_por_nome as faturamento_por,
      fm.data_envio_nota
    from fm
    join flags fl on fl.id = fm.id
  ),
  ranked as (
    select c.*,
      row_number() over (
        partition by c.empresa_id, c.periodo
        order by case c.status
          when 'Enviada' then 1
          when 'Nota emitida' then 2
          when 'Aguardando validação' then 3
          when 'Faturado' then 4
          when 'Em faturamento' then 5
          when 'Fora do prazo' then 6
          when 'Aguardando nota' then 7
          else 8 end
      ) as rn
    from calc c
  )
  select r.empresa_id, r.periodo, r.status, r.faturamento_por, r.data_envio_nota
  from ranked r
  where r.rn = 1;
end;
$$;
REVOKE ALL ON FUNCTION public.status_faturamento_competencia(text) FROM public;
GRANT EXECUTE ON FUNCTION public.status_faturamento_competencia(text) TO authenticated;
COMMENT ON FUNCTION public.status_faturamento_competencia(text) IS 'Status operacional por empresa e período: somente lançamentos normais; primeira mensalidade não representa fechamento de movimentação.';