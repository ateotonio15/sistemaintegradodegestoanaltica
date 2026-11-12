CREATE SCHEMA IF NOT EXISTS integracao;
GRANT USAGE ON SCHEMA integracao TO service_role;
COMMENT ON SCHEMA integracao IS 'API de integração SIGA x Portal Financeiro. USAGE NUNCA deve ser concedido a anon, authenticated ou PUBLIC: a segurança dos wrappers public.integracao_* depende deste bloqueio.';

-- Status: espelha calcularStatus/isForaDoPrazo (movimentacao-utils.ts:15-35).
-- Prazo = make_date(ano,mes,1)+fim, igual a new Date(y,m-1,fim+1) (inclui rolagem de mês).
CREATE FUNCTION integracao.fn_status_movimentacao(
  p_envio_financeiro date, p_envio_empresa date, p_mes text, p_periodo text,
  p_hoje date DEFAULT (now() AT TIME ZONE 'America/Manaus')::date)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_envio_financeiro IS NOT NULL THEN 'enviado_financeiro'
    WHEN p_envio_empresa IS NOT NULL THEN 'enviado_empresa'
    WHEN coalesce(p_periodo !~ '^\d{2}-\d{2}$' OR p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$', true)
      THEN 'aguardando_envio'
    WHEN p_hoje >= make_date(split_part(p_mes,'-',1)::int, split_part(p_mes,'-',2)::int, 1)
                   + split_part(p_periodo,'-',2)::int THEN 'fora_do_prazo'
    ELSE 'aguardando_envio' END $$;

CREATE FUNCTION integracao.fn_status_label(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p WHEN 'enviado_financeiro' THEN 'Enviado ao financeiro'
    WHEN 'enviado_empresa' THEN 'Enviado para empresa'
    WHEN 'fora_do_prazo' THEN 'Fora do prazo' ELSE 'Aguardando envio' END $$;

CREATE FUNCTION integracao.fn_cnpj(p text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN length(d) BETWEEN 1 AND 14 THEN lpad(d,14,'0') END
  FROM (SELECT regexp_replace(coalesce(p,''),'\D','','g') d) x $$;

-- Visibilidade = filtros de Movimentacoes.tsx (Inativa + permiteCompetenciaMovimentacao).
CREATE FUNCTION integracao.fn_mov_visivel(m public.movimentacoes, e public.empresas)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT e.id IS NULL OR (
    e.status_empresa IS DISTINCT FROM 'Inativa'
    AND CASE WHEN e.primeira_competencia_financeira IS NOT NULL
             THEN m.mes_referencia >= e.primeira_competencia_financeira
             ELSE e.status_implantacao IS DISTINCT FROM 'aguardando_primeiro_fechamento' END) $$;

-- Aba da tela: ADMINISTRADORA ou o resto (EMPRESARIAL/nulo/sem empresa).
CREATE FUNCTION integracao.fn_aba(e public.empresas) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN coalesce(e.tipo_contrato,'') = 'ADMINISTRADORA' THEN 'ADMINISTRADORA' ELSE 'EMPRESARIAL' END $$;

-- Faturamento (opção A): corpo idêntico ao atual, sem a guarda.
CREATE FUNCTION integracao._status_faturamento_core(p_mes text)
RETURNS TABLE(empresa_id uuid, periodo text, status text, faturamento_por text, data_envio_nota date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
begin
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
end; $function$;

CREATE OR REPLACE FUNCTION public.status_faturamento_competencia(p_mes text)
 RETURNS TABLE(empresa_id uuid, periodo text, status text, faturamento_por text, data_envio_nota date)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    return;
  end if;
  return query select * from integracao._status_faturamento_core(p_mes);
end;
$function$;

-- JSON de uma movimentação (sem e-mails, telefones, endereços, valores, faixas).
CREATE FUNCTION integracao._mov_json(m public.movimentacoes, p_detalhe boolean, p_fat text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', m.id, 'competencia', m.mes_referencia, 'periodo', m.periodo,
    'tipo_movimentacao', m.tipo_movimentacao,
    'status', jsonb_build_object('codigo', st.c, 'label', integracao.fn_status_label(st.c)),
    'empresa', CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object(
       'id', e.id, 'nome', e.nome, 'codigo_contrato', e.codigo_contrato,
       'cnpj', integracao.fn_cnpj(e.cnpj), 'tipo_contrato', e.tipo_contrato,
       'responsavel_contrato', coalesce(pr.display_name, e.responsavel_contrato),
       'grupo_financeiro', (SELECT jsonb_build_object('id', g.id, 'nome', g.nome_grupo,
            'principal', g.contrato_principal_empresa_id = e.id)
          FROM grupos_financeiros_contratos gc JOIN grupos_financeiros g ON g.id = gc.grupo_id
          WHERE gc.empresa_id = e.id AND gc.ativo ORDER BY gc.adicionado_em DESC LIMIT 1)) END,
    'datas', jsonb_build_object('envio_empresa', m.data_envio_empresa,
       'retorno_empresa', m.data_retorno_empresa, 'envio_financeiro', m.data_envio_financeiro),
    'responsavel_movimentacao', m.responsavel_movimentacao,
    'relatorio', (SELECT jsonb_build_object('status', r.status, 'confirmacao', r.confirmacao,
        'enviado_em', (SELECT max(x.enviado_em) FROM movimentacao_relatorio_envios x WHERE x.movimentacao_id = m.id))
        FROM movimentacao_relatorios r WHERE r.movimentacao_id = m.id),
    'suspensao', CASE WHEN coalesce(e.contrato_suspenso,false) THEN jsonb_build_object(
        'suspenso', true, 'desde', coalesce(e.data_suspensao, s.data_inicio),
        'motivo', coalesce(e.motivo_suspensao, s.motivo)) END,
    'faturamento_siga', jsonb_build_object('status', p_fat,
       -- Mesmo texto da coluna "Status Faturamento" (Movimentacoes.tsx:1354-1371, labelStatusFinanceiro).
       'label', CASE
         WHEN p_fat IS NULL AND coalesce(e.contrato_suspenso,false) AND EXISTS (
              SELECT 1 FROM movimentacao_suspensos_encaminhamentos se
              WHERE se.empresa_id = e.id AND se.mes_referencia = m.mes_referencia AND se.status = 'encaminhado')
           THEN 'Encaminhado ao Financeiro'
         WHEN p_fat = 'Aguardando nota' THEN 'Aguardando Emissão'
         ELSE p_fat END),
    'anexos_count', (SELECT count(*) FROM anexos_movimentacao a WHERE a.movimentacao_id = m.id)
  ) || CASE WHEN p_detalhe THEN jsonb_build_object('observacoes', m.observacoes) ELSE '{}'::jsonb END
  FROM (SELECT integracao.fn_status_movimentacao(m.data_envio_financeiro, m.data_envio_empresa, m.mes_referencia, m.periodo) c) st
  LEFT JOIN empresas e ON e.id = m.empresa_id
  LEFT JOIN profiles pr ON pr.user_id = e.responsavel_user_id
  LEFT JOIN LATERAL (SELECT es.data_inicio, es.motivo FROM empresa_suspensoes es
       WHERE es.empresa_id = e.id AND es.data_fim IS NULL ORDER BY es.data_inicio DESC LIMIT 1) s ON true $$;

CREATE FUNCTION integracao.listar_movimentacoes(
  p_competencia text, p_periodo text DEFAULT NULL, p_status text DEFAULT NULL,
  p_contrato text DEFAULT NULL, p_cnpj text DEFAULT NULL, p_tipo_contrato text DEFAULT NULL,
  p_after_id uuid DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH lim AS (SELECT least(greatest(coalesce(p_limit,100),1),500) n),
  fat AS (SELECT * FROM integracao._status_faturamento_core(p_competencia)),
  f AS (
    SELECT m AS mov, m.id, fat.status AS fat
    FROM movimentacoes m LEFT JOIN empresas e ON e.id = m.empresa_id
    LEFT JOIN fat ON fat.empresa_id = m.empresa_id AND fat.periodo = m.periodo
    WHERE m.mes_referencia = p_competencia
      AND integracao.fn_mov_visivel(m, e)
      AND (p_tipo_contrato IS NULL OR integracao.fn_aba(e) = upper(p_tipo_contrato))
      AND (p_periodo IS NULL OR m.periodo = p_periodo)
      AND (p_contrato IS NULL OR e.codigo_contrato = p_contrato)
      AND (p_cnpj IS NULL OR integracao.fn_cnpj(e.cnpj) = integracao.fn_cnpj(p_cnpj))
      AND (p_status IS NULL OR integracao.fn_status_movimentacao(m.data_envio_financeiro,
             m.data_envio_empresa, m.mes_referencia, m.periodo) = p_status)
      AND (p_after_id IS NULL OR m.id > p_after_id)
    ORDER BY m.id LIMIT (SELECT n FROM lim) + 1),
  r AS (SELECT row_number() OVER (ORDER BY id) rn, f.* FROM f)
  SELECT jsonb_build_object(
    'data', coalesce(jsonb_agg(integracao._mov_json(r.mov, false, r.fat) ORDER BY r.id)
              FILTER (WHERE r.rn <= (SELECT n FROM lim)), '[]'::jsonb),
    'last_id', (max(r.id::text) FILTER (WHERE r.rn <= (SELECT n FROM lim))),
    'has_more', count(*) > (SELECT n FROM lim))
  FROM r $$;

CREATE FUNCTION integracao.obter_movimentacao(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT integracao._mov_json(m, true,
    (SELECT fat.status FROM integracao._status_faturamento_core(m.mes_referencia) fat
      WHERE fat.empresa_id = m.empresa_id AND fat.periodo = m.periodo))
  FROM movimentacoes m WHERE m.id = p_id $$;

-- storage_path fica só dentro da edge (gera URL assinada de 120 s); não sai no JSON.
CREATE FUNCTION integracao.listar_anexos(p_movimentacao_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'nome_arquivo', a.nome_arquivo,
    'mime_type', a.mime_type, 'tamanho_bytes', a.tamanho_bytes, 'created_at', a.created_at,
    'storage_path', a.storage_path) ORDER BY a.created_at), '[]'::jsonb)
  FROM anexos_movimentacao a WHERE a.movimentacao_id = p_movimentacao_id $$;

CREATE FUNCTION integracao.historico_movimentacao(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.ocorrido_em DESC), '[]'::jsonb) FROM (
    SELECT x.criado_em AS ocorrido_em, x.evento,
      concat_ws(' ', initcap(replace(x.evento,'_',' ')),
        CASE WHEN x.tipo_relatorio IS NOT NULL THEN '— ' || x.tipo_relatorio END,
        CASE WHEN x.origem IS NOT NULL THEN '(origem: ' || x.origem || ')' END) AS descricao,
      x.usuario_nome, x.nome_arquivo
    FROM movimentacao_fechamento_historico x WHERE x.movimentacao_id = p_id
    UNION ALL
    SELECT e.enviado_em, 'relatorio_enviado', 'Relatórios enviados por e-mail à empresa',
           coalesce(e.nome_remetente, p.display_name), NULL
    FROM movimentacao_relatorio_envios e LEFT JOIN profiles p ON p.user_id = e.enviado_por
    WHERE e.movimentacao_id = p_id) h $$;

-- Resumo = Movimentacoes.tsx:1196-1223; enviados = resumoEnvioRelatorios; pendentes = total - enviados.
CREATE FUNCTION integracao.resumo_periodos(p_competencia text, p_tipo_contrato text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p(periodo, ord) AS (VALUES ('01-05',1),('05-10',2),('10-15',3),('15-20',4),('20-25',5),('25-30',6)),
  v AS (
    SELECT m.periodo,
      integracao.fn_status_movimentacao(m.data_envio_financeiro, m.data_envio_empresa, m.mes_referencia, m.periodo) st,
      coalesce(r.data_envio IS NOT NULL AND r.status IN ('Enviado','Conferido pela empresa','Divergência informada'), false) env
    FROM movimentacoes m LEFT JOIN empresas e ON e.id = m.empresa_id
    LEFT JOIN movimentacao_relatorios r ON r.movimentacao_id = m.id
    WHERE m.mes_referencia = p_competencia AND integracao.fn_mov_visivel(m, e)
      AND (p_tipo_contrato IS NULL OR integracao.fn_aba(e) = upper(p_tipo_contrato)))
  SELECT jsonb_build_object('competencia', p_competencia, 'periodos', jsonb_agg(jsonb_build_object(
    'periodo', p.periodo,
    'total', (SELECT count(*) FROM v WHERE v.periodo = p.periodo),
    'concluidas', (SELECT count(*) FROM v WHERE v.periodo = p.periodo AND v.st = 'enviado_financeiro'),
    'enviados', (SELECT count(*) FROM v WHERE v.periodo = p.periodo AND v.env),
    'pendentes', (SELECT count(*) FROM v WHERE v.periodo = p.periodo AND NOT v.env)) ORDER BY p.ord))
  FROM p $$;

CREATE FUNCTION integracao.contratos_suspensos(p_competencia text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('empresa_nome', s.empresa_nome,
    'codigo_contrato', s.codigo_contrato, 'periodo', s.periodo, 'status', s.status,
    'encaminhado_em', s.encaminhado_em, 'encaminhado_por_nome', s.encaminhado_por_nome,
    'reativado_em', s.reativado_em) ORDER BY s.empresa_nome, s.periodo), '[]'::jsonb)
  FROM movimentacao_suspensos_encaminhamentos s WHERE s.mes_referencia = p_competencia $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA integracao TO service_role;

-- Wrappers finos (SECURITY INVOKER) chamáveis só por service_role.
CREATE FUNCTION public.integracao_listar_movimentacoes(p_competencia text, p_periodo text DEFAULT NULL,
  p_status text DEFAULT NULL, p_contrato text DEFAULT NULL, p_cnpj text DEFAULT NULL,
  p_tipo_contrato text DEFAULT NULL, p_after_id uuid DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.listar_movimentacoes(p_competencia, p_periodo, p_status, p_contrato, p_cnpj,
    p_tipo_contrato, p_after_id, p_limit) $$;
CREATE FUNCTION public.integracao_obter_movimentacao(p_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.obter_movimentacao(p_id) $$;
CREATE FUNCTION public.integracao_listar_anexos(p_movimentacao_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.listar_anexos(p_movimentacao_id) $$;
CREATE FUNCTION public.integracao_historico_movimentacao(p_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.historico_movimentacao(p_id) $$;
CREATE FUNCTION public.integracao_resumo_periodos(p_competencia text, p_tipo_contrato text DEFAULT NULL) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.resumo_periodos(p_competencia, p_tipo_contrato) $$;
CREATE FUNCTION public.integracao_contratos_suspensos(p_competencia text) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  -- NÃO trocar para SECURITY DEFINER: a segurança depende do bloqueio do schema integracao.
  SELECT integracao.contratos_suspensos(p_competencia) $$;

GRANT EXECUTE ON FUNCTION
  public.integracao_listar_movimentacoes(text,text,text,text,text,text,uuid,int),
  public.integracao_obter_movimentacao(uuid), public.integracao_listar_anexos(uuid),
  public.integracao_historico_movimentacao(uuid), public.integracao_resumo_periodos(text,text),
  public.integracao_contratos_suspensos(text)
  TO service_role;