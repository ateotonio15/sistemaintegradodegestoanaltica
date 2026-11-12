# Fase 1 — API somente leitura (revisão 2, para nova aprovação)

Nada foi aplicado. Respostas aos 9 ajustes e SQL completo revisado.

## 1. Por que 288 e não 264 (2026-11, consulta somente leitura)
| tipo_contrato | categoria | qtd |
|---|---|---|
| EMPRESARIAL | visível na aba Empresas | **264** |
| ADMINISTRADORA | visível na aba Administradoras | **19** |
| EMPRESARIAL | empresa Inativa (escondida) | 5 |
| — | antes da 1ª competência / aguardando 1º fechamento / sem empresa | 0 |

288 = 264 + 19 + 5. A tela (Movimentacoes.tsx:331-343 e 596-601) esconde `status_empresa = 'Inativa'`
e aplica `permiteCompetenciaMovimentacao`; a aba é decidida por `tipo_contrato = 'ADMINISTRADORA'`
(nulo/vazio cai em Empresas; linha sem empresa também aparece em Empresas).
Predicado único `integracao.fn_mov_visivel` reproduz isso e é usado na listagem e no resumo.
Aceite após aplicar: listagem `tipo_contrato=EMPRESARIAL` = 264, `ADMINISTRADORA` = 19; soma do resumo = total da listagem (283).
O resumo ganha filtro opcional `p_tipo_contrato` (a tela calcula o resumo por aba); sem filtro soma as duas abas.

## 4. Critério de suspensão da tela
A tela usa só a empresa: `contratoSuspenso()` = `empresas.contrato_suspenso`, e mostra
"Desde" = `empresas.data_suspensao`, "Motivo" = `empresas.motivo_suspensao` (Movimentacoes.tsx:1335-1343).
O trigger `trg_empresa_suspensao_fluxo` também dispara por `empresas.contrato_suspenso`.
Alinhado: `suspenso` vem de `empresas.contrato_suspenso`; desde/motivo da empresa, com fallback para a
suspensão aberta (`empresa_suspensoes.data_fim IS NULL`, mesmo critério do índice).

## 5. Entrada inválida no TS
`parseInt` dá NaN → `new Date(NaN)` → comparação falsa → **"Aguardando envio"**; ano/mês 0 também.
A função valida por regex e devolve `aguardando_envio`, sem bloco EXCEPTION.

## 9. Faturamento — corpo completo lido
`auth.uid()` aparece **só na guarda inicial**; nenhum filtro por usuário. Segue **opção A**:
o corpo vai inteiro para `integracao._status_faturamento_core(p_mes)` (texto idêntico), e a pública fica:
```diff
 begin
   if auth.uid() is null then return; end if;
-  return query with fm as ( ... 90 linhas ... ) select ... where r.rn = 1;
+  return query select * from integracao._status_faturamento_core(p_mes);
 end;
```
Teste antes/depois: minha ferramenta de leitura não tem permissão de executar a pública, então
capturo a saída de `status_faturamento_competencia('2026-11')` com sessão real de admin no navegador
**antes** de aplicar e repito **depois**, comparando md5 e contagem (resultado vai no relatório).

## 8. Acesso da edge
Wrappers `public.integracao_*` (LANGUAGE sql, SECURITY INVOKER), REVOKE de PUBLIC/anon/authenticated,
GRANT só a service_role; edge chama `supabase.rpc('integracao_...')`. Teste: chamar cada wrapper com
token de usuário logado → espera erro 42501 (permission denied).

## 3. Paginação
SQL devolve `last_id` interno; a edge converte em `next_cursor` = base64url(último id) e `null` quando `has_more=false`. `last_id` nunca sai na resposta.

## Migration proposta: `integracao_fase1_leitura`
```sql
CREATE SCHEMA IF NOT EXISTS integracao;
REVOKE ALL ON SCHEMA integracao FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA integracao TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA integracao REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Status: espelha calcularStatus/isForaDoPrazo (movimentacao-utils.ts:15-35).
-- Prazo = make_date(ano,mes,1)+fim, igual a new Date(y,m-1,fim+1) (inclui rolagem de mês).
CREATE FUNCTION integracao.fn_status_movimentacao(
  p_envio_financeiro date, p_envio_empresa date, p_mes text, p_periodo text,
  p_hoje date DEFAULT (now() AT TIME ZONE 'America/Manaus')::date)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_envio_financeiro IS NOT NULL THEN 'enviado_financeiro'
    WHEN p_envio_empresa IS NOT NULL THEN 'enviado_empresa'
    WHEN p_periodo ~ '^\d{2}-\d{2}$' AND p_mes ~ '^\d{4}-(0[1-9]|1[0-2])$'
     AND p_hoje >= make_date(split_part(p_mes,'-',1)::int, split_part(p_mes,'-',2)::int, 1)
                   + split_part(p_periodo,'-',2)::int
      THEN 'fora_do_prazo'
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
  <<< CORPO COPIADO BYTE A BYTE de "with fm as (" até "where r.rn = 1;" >>>
end; $function$;

CREATE OR REPLACE FUNCTION public.status_faturamento_competencia(p_mes text)
RETURNS TABLE(empresa_id uuid, periodo text, status text, faturamento_por text, data_envio_nota date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if auth.uid() is null then return; end if;
  return query select * from integracao._status_faturamento_core(p_mes);
end; $function$;

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
    'faturamento_siga', jsonb_build_object('status', p_fat),
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

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA integracao FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA integracao TO service_role;

-- Wrappers finos (SECURITY INVOKER) chamáveis só por service_role.
CREATE FUNCTION public.integracao_listar_movimentacoes(p_competencia text, p_periodo text DEFAULT NULL,
  p_status text DEFAULT NULL, p_contrato text DEFAULT NULL, p_cnpj text DEFAULT NULL,
  p_tipo_contrato text DEFAULT NULL, p_after_id uuid DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER AS $$
  SELECT integracao.listar_movimentacoes(p_competencia, p_periodo, p_status, p_contrato, p_cnpj,
    p_tipo_contrato, p_after_id, p_limit) $$;
CREATE FUNCTION public.integracao_obter_movimentacao(p_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT integracao.obter_movimentacao(p_id) $$;
CREATE FUNCTION public.integracao_listar_anexos(p_movimentacao_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT integracao.listar_anexos(p_movimentacao_id) $$;
CREATE FUNCTION public.integracao_historico_movimentacao(p_id uuid) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT integracao.historico_movimentacao(p_id) $$;
CREATE FUNCTION public.integracao_resumo_periodos(p_competencia text, p_tipo_contrato text DEFAULT NULL) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT integracao.resumo_periodos(p_competencia, p_tipo_contrato) $$;
CREATE FUNCTION public.integracao_contratos_suspensos(p_competencia text) RETURNS jsonb
  LANGUAGE sql STABLE SECURITY INVOKER AS $$ SELECT integracao.contratos_suspensos(p_competencia) $$;

REVOKE EXECUTE ON FUNCTION
  public.integracao_listar_movimentacoes(text,text,text,text,text,text,uuid,int),
  public.integracao_obter_movimentacao(uuid), public.integracao_listar_anexos(uuid),
  public.integracao_historico_movimentacao(uuid), public.integracao_resumo_periodos(text,text),
  public.integracao_contratos_suspensos(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.integracao_listar_movimentacoes(text,text,text,text,text,text,uuid,int),
  public.integracao_obter_movimentacao(uuid), public.integracao_listar_anexos(uuid),
  public.integracao_historico_movimentacao(uuid), public.integracao_resumo_periodos(text,text),
  public.integracao_contratos_suspensos(text)
  TO service_role;
```
(O trecho `<<< CORPO COPIADO >>>` será o texto atual de `status_faturamento_competencia`, sem alteração.)

## Depois da aprovação
1. Capturar saída do faturamento (antes), aplicar, capturar (depois) e comparar.
2. Aceite de contagens (264 / 19 / 283) e paridade de status servidor × `calcularStatus`.
3. Teste de permissão 42501 nos wrappers com usuário logado.
4. Edge `siga-api` + testes Deno, secret, script de assinatura, URL e seção no doc. Commit só com sua aprovação.
