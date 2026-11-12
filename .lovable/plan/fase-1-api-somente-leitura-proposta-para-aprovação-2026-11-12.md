# Fase 1 — API somente leitura (proposta para aprovação)

Nada foi aplicado ainda. Abaixo: SQL da migration, decisões e 1 ponto que precisa da sua decisão.

## Ponto aberto (precisa de decisão)

`public.status_faturamento_competencia(p_mes)` é SECURITY DEFINER e começa com
`if auth.uid() is null then return; end if;`. Chamada com service_role (sem usuário) ela
retorna vazio, então `faturamento_siga.status` sairia sempre null. Opções:

- **A)** Extrair o corpo para `integracao._status_faturamento_core(p_mes)` e fazer a função
pública só checar `auth.uid()` e chamar o core (altera função existente; comportamento igual).
- **B)** Copiar o corpo para `integracao` (sem alterar a pública; duplica a regra).
- **C)** Deixar `faturamento_siga = null` nesta fase.
O SQL abaixo assume **C** (não toca nada existente) até você escolher.

## Paridade prévia (já rodei a regra em consulta somente leitura, 2026-11, data Manaus 12/11/2026)

aguardando_envio 206 · enviado_empresa 4 · enviado_financeiro 77 · fora_do_prazo 1 (total 288).
Após aplicar, rodo a paridade oficial com a função vs. a regra TS (via teste Vitest
executando `calcularStatus` sobre as mesmas linhas com relógio fixado) e listo divergências.

## Migration proposta: `integracao_fase1_leitura`

```sql
CREATE SCHEMA IF NOT EXISTS integracao;
REVOKE ALL ON SCHEMA integracao FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA integracao TO service_role;

-- 1. Status (espelha src/lib/movimentacao-utils.ts calcularStatus/isForaDoPrazo)
-- prazo = dia seguinte ao fim do período: make_date(ano,mes,1) + fim (igual a new Date(y,m-1,fim+1),
-- inclusive rolagem de mês, ex. fevereiro 25-30). Mesma regra p/ Fechada, Diária e Administradora.
CREATE OR REPLACE FUNCTION integracao.fn_status_movimentacao(
  p_envio_financeiro date, p_envio_empresa date, p_mes text, p_periodo text,
  p_hoje date DEFAULT (now() AT TIME ZONE 'America/Manaus')::date)
RETURNS text LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_fim int; v_ano int; v_mes int;
BEGIN
  IF p_envio_financeiro IS NOT NULL THEN RETURN 'enviado_financeiro'; END IF;
  IF p_envio_empresa IS NOT NULL THEN RETURN 'enviado_empresa'; END IF;
  BEGIN
    v_fim := split_part(p_periodo,'-',2)::int;
    v_ano := split_part(p_mes,'-',1)::int; v_mes := split_part(p_mes,'-',2)::int;
    IF p_hoje >= make_date(v_ano, v_mes, 1) + v_fim THEN RETURN 'fora_do_prazo'; END IF;
  EXCEPTION WHEN others THEN NULL; END;
  RETURN 'aguardando_envio';
END $$;

CREATE OR REPLACE FUNCTION integracao.fn_status_label(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE p
  WHEN 'enviado_financeiro' THEN 'Enviado ao financeiro'
  WHEN 'enviado_empresa' THEN 'Enviado para empresa'
  WHEN 'fora_do_prazo' THEN 'Fora do prazo' ELSE 'Aguardando envio' END $$;

CREATE OR REPLACE FUNCTION integracao.fn_cnpj(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT NULLIF(lpad(regexp_replace(coalesce(p,''),'\D','','g'),14,'0'),'00000000000000') $$;

-- 2. Objeto JSON de uma movimentação (sem e-mails/telefones/valores)
CREATE OR REPLACE FUNCTION integracao._mov_json(m public.movimentacoes, p_detalhe boolean)
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
          WHERE gc.empresa_id = e.id AND gc.ativo LIMIT 1)) END,
    'datas', jsonb_build_object('envio_empresa', m.data_envio_empresa,
       'retorno_empresa', m.data_retorno_empresa, 'envio_financeiro', m.data_envio_financeiro),
    'responsavel_movimentacao', m.responsavel_movimentacao,
    'relatorio', (SELECT jsonb_build_object('status', r.status, 'confirmacao', r.confirmacao,
        'enviado_em', (SELECT max(x.enviado_em) FROM movimentacao_relatorio_envios x WHERE x.movimentacao_id = m.id))
        FROM movimentacao_relatorios r WHERE r.movimentacao_id = m.id),
    'suspensao', CASE WHEN coalesce(e.contrato_suspenso,false) OR s.id IS NOT NULL
        THEN jsonb_build_object('suspenso', true, 'desde', s.data_inicio, 'motivo', s.motivo) END,
    'faturamento_siga', jsonb_build_object('status', NULL),   -- ver ponto aberto
    'anexos_count', (SELECT count(*) FROM anexos_movimentacao a WHERE a.movimentacao_id = m.id)
  ) || CASE WHEN p_detalhe THEN jsonb_build_object('observacoes', m.observacoes) ELSE '{}'::jsonb END
  FROM (SELECT integracao.fn_status_movimentacao(m.data_envio_financeiro, m.data_envio_empresa, m.mes_referencia, m.periodo) c) st
  LEFT JOIN empresas e ON e.id = m.empresa_id
  LEFT JOIN profiles pr ON pr.user_id = e.responsavel_user_id
  LEFT JOIN LATERAL (SELECT * FROM empresa_suspensoes es WHERE es.empresa_id = e.id
       AND es.reativado_em IS NULL ORDER BY es.data_inicio DESC LIMIT 1) s ON true
$$;

-- 3. Leitura
CREATE OR REPLACE FUNCTION integracao.listar_movimentacoes(
  p_competencia text, p_periodo text DEFAULT NULL, p_status text DEFAULT NULL,
  p_contrato text DEFAULT NULL, p_cnpj text DEFAULT NULL, p_tipo_contrato text DEFAULT NULL,
  p_after_id uuid DEFAULT NULL, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH f AS (
    SELECT m.* FROM movimentacoes m LEFT JOIN empresas e ON e.id = m.empresa_id
    WHERE m.mes_referencia = p_competencia
      AND (p_periodo IS NULL OR m.periodo = p_periodo)
      AND (p_contrato IS NULL OR e.codigo_contrato = p_contrato)
      AND (p_cnpj IS NULL OR integracao.fn_cnpj(e.cnpj) = integracao.fn_cnpj(p_cnpj))
      AND (p_tipo_contrato IS NULL OR e.tipo_contrato = p_tipo_contrato)
      AND (p_status IS NULL OR integracao.fn_status_movimentacao(m.data_envio_financeiro,
             m.data_envio_empresa, m.mes_referencia, m.periodo) = p_status)
      AND (p_after_id IS NULL OR m.id > p_after_id)
    ORDER BY m.id LIMIT least(greatest(coalesce(p_limit,100),1),500) + 1),
  n AS (SELECT row_number() OVER (ORDER BY id) rn, f.* FROM f)
  SELECT jsonb_build_object(
    'data', coalesce(jsonb_agg(integracao._mov_json(
        ROW(n.id,n.empresa_id,n.mes_referencia,n.periodo,n.data_envio_empresa,n.data_retorno_empresa,
            n.data_envio_financeiro,n.responsavel_movimentacao,n.observacoes,n.created_at,n.updated_at,
            n.tipo_movimentacao,n.dentro_prazo,n.cc_email)::public.movimentacoes, false) ORDER BY n.id)
      FILTER (WHERE rn <= least(greatest(coalesce(p_limit,100),1),500)), '[]'::jsonb),
    'last_id', max(n.id::text) FILTER (WHERE rn <= least(greatest(coalesce(p_limit,100),1),500)),
    'has_more', count(*) > least(greatest(coalesce(p_limit,100),1),500))
  FROM n $$;

CREATE OR REPLACE FUNCTION integracao.obter_movimentacao(p_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT integracao._mov_json(m, true) FROM movimentacoes m WHERE m.id = p_id $$;

CREATE OR REPLACE FUNCTION integracao.listar_anexos(p_movimentacao_id uuid)
RETURNS TABLE(id uuid, nome_arquivo text, mime_type text, tamanho_bytes bigint, created_at timestamptz, storage_path text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.nome_arquivo, a.mime_type, a.tamanho_bytes, a.created_at, a.storage_path
  FROM anexos_movimentacao a WHERE a.movimentacao_id = p_movimentacao_id ORDER BY a.created_at $$;
-- storage_path só é usado dentro da edge function para gerar a URL assinada de 120 s; não sai no JSON.

CREATE OR REPLACE FUNCTION integracao.historico_movimentacao(p_id uuid)
RETURNS TABLE(ocorrido_em timestamptz, evento text, descricao text, usuario_nome text, nome_arquivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT h.criado_em, h.evento,
    concat_ws(' ', initcap(replace(h.evento,'_',' ')),
      CASE WHEN h.tipo_relatorio IS NOT NULL THEN '— ' || h.tipo_relatorio END,
      CASE WHEN h.origem IS NOT NULL THEN '(origem: ' || h.origem || ')' END),
    h.usuario_nome, h.nome_arquivo
  FROM movimentacao_fechamento_historico h WHERE h.movimentacao_id = p_id
  UNION ALL
  SELECT e.enviado_em, 'relatorio_enviado', 'Relatório de vidas enviado por e-mail à empresa',
         coalesce(e.nome_remetente, p.display_name), NULL
  FROM movimentacao_relatorio_envios e LEFT JOIN profiles p ON p.user_id = e.enviado_por
  WHERE e.movimentacao_id = p_id
  ORDER BY 1 DESC $$;

-- Mesma regra de Movimentacoes.tsx (Resumo Geral por Período): exclui empresa Inativa
-- e competência anterior à primeira competência financeira; concluídas = enviado_financeiro;
-- enviados = relatório com data_envio e status Enviado/Conferido pela empresa/Divergência informada.
CREATE OR REPLACE FUNCTION integracao.resumo_periodos(p_competencia text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p(periodo, ord) AS (VALUES ('01-05',1),('05-10',2),('10-15',3),('15-20',4),('20-25',5),('25-30',6)),
  m AS (
    SELECT m.periodo,
      integracao.fn_status_movimentacao(m.data_envio_financeiro, m.data_envio_empresa, m.mes_referencia, m.periodo) st,
      (r.data_envio IS NOT NULL AND r.status IN ('Enviado','Conferido pela empresa','Divergência informada')) env
    FROM movimentacoes m LEFT JOIN empresas e ON e.id = m.empresa_id
    LEFT JOIN movimentacao_relatorios r ON r.movimentacao_id = m.id
    WHERE m.mes_referencia = p_competencia
      AND coalesce(e.status_empresa,'') <> 'Inativa'
      AND CASE WHEN e.primeira_competencia_financeira IS NOT NULL THEN m.mes_referencia >= e.primeira_competencia_financeira
               ELSE coalesce(e.status_implantacao,'') <> 'aguardando_primeiro_fechamento' END)
  SELECT jsonb_build_object('competencia', p_competencia, 'periodos', jsonb_agg(jsonb_build_object(
    'periodo', p.periodo,
    'total', (SELECT count(*) FROM m WHERE m.periodo = p.periodo),
    'concluidas', (SELECT count(*) FROM m WHERE m.periodo = p.periodo AND st = 'enviado_financeiro'),
    'enviados', (SELECT count(*) FROM m WHERE m.periodo = p.periodo AND env),
    'pendentes', (SELECT count(*) FROM m WHERE m.periodo = p.periodo AND NOT env)) ORDER BY p.ord))
  FROM p $$;

CREATE OR REPLACE FUNCTION integracao.contratos_suspensos(p_competencia text)
RETURNS TABLE(empresa_nome text, codigo_contrato text, periodo text, status text,
              encaminhado_em timestamptz, encaminhado_por_nome text, reativado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.empresa_nome, s.codigo_contrato, s.periodo, s.status, s.encaminhado_em,
         s.encaminhado_por_nome, s.reativado_em
  FROM movimentacao_suspensos_encaminhamentos s WHERE s.mes_referencia = p_competencia
  ORDER BY s.empresa_nome, s.periodo $$;

-- 4. Somente service_role executa
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA integracao FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA integracao TO service_role;
```

Observação: `integracao` não está nos schemas expostos da API; a edge function chamará as
funções com `supabase.schema('integracao').rpc(...)`, o que exige incluir `integracao` em
"exposed schemas". Como isso não pode ser feito aqui, a alternativa sem expor o schema é a
edge function usar conexão Postgres direta (`SUPABASE_DB_URL`, já disponível nas funções) com
`npm:postgres` — **nova dependência, só dentro da edge function**. Proponho essa via.

## Depois da aprovação

1. Aplicar a migration e rodar a paridade oficial.
2. Criar `supabase/functions/siga-api` (HMAC, rotas, problem+json, logs, sem CORS) e
  `verify_jwt = false` no config.toml; testes Deno (vetor a, paths b/c, 401 d) com saída.
3. Pedir o secret `PORTAL_FINANCEIRO_HMAC_SECRET` (você cadastra).
4. `scripts/assinar-requisicao.ts`, URL final e seção "Fase 1 — implementado" no doc.
5. Commit só após sua aprovação.

&nbsp;

NÃO aplique ainda. Ajustes necessários antes da aprovação:

1. VISIBILIDADE / PARIDADE DE CONTAGEM

A paridade deu 288 movimentações em 2026-11, mas a tela /movimentacoes mostra 264

na aba Empresas (cards somam 264). Antes de tudo, explique a diferença (quantas são

ADMINISTRADORA, Inativa, anteriores à primeira competência financeira, aguardando

primeiro fechamento, etc.).

Depois crie UM predicado único de visibilidade (ex.: integracao.fn_mov_visivel)

que reproduza exatamente o que a tela lista, e use-o em listar_movimentacoes E em

resumo_periodos. Critério de aceite: para 2026-11, contagem por tipo_contrato da API

= contagem de cada aba da tela; soma dos totais do resumo = total da listagem.

2. NÃO reconstruir a linha com ROW(...)::public.movimentacoes listando colunas

(quebra quando uma coluna for adicionada). Carregue a linha como composite

(SELECT m AS mov, [m.id](http://m.id) ...) e passe [n.mov](http://n.mov) para *mov*json.

3. PAGINAÇÃO: a edge function deve devolver "next_cursor" (opaco; ex.: base64 do

último id) e null quando has_more=false. Não expor "last_id".

4. SUSPENSÃO: use o mesmo critério de "suspensão aberta" que a tela e o trigger

trg_empresa_suspensao_fluxo usam (o índice idx_empresa_suspensoes_aberta usa

data_fim IS NULL). Mostre qual critério a tela usa e alinhe.

5. fn_status_movimentacao: remover o bloco EXCEPTION WHEN others (subtransação por

linha e engole dado inválido). Validar p_periodo ~ '^\d{2}-\d{2}$' e

p_mes ~ '^\d{4}-\d{2}$'; se inválido, retornar 'aguardando_envio' (mesmo

comportamento do TS — confirme qual é).

6. Histórico: descrição do envio = "Relatórios enviados por e-mail à empresa"

(o envio inclui PDF de vidas e XLSX de mensalidades).

7. Adicionar:

ALTER DEFAULT PRIVILEGES IN SCHEMA integracao REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

8. ACESSO DA EDGE ÀS FUNÇÕES: NÃO usar conexão Postgres direta nem npm:postgres.

Criar wrappers finos em public (prefixo integracao_*, LANGUAGE sql, SECURITY

INVOKER) que apenas chamam as funções do schema integracao, com:

REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION ... TO service_role;

A edge chama via supabase.rpc('integracao_...') com o client service_role.

Inclua um teste provando que um usuário authenticated recebe erro de permissão

ao chamar os wrappers.

9. FATURAMENTO: antes de decidir, mostre o corpo COMPLETO de

public.status_faturamento_competencia. Se auth.uid() for usado apenas na guarda

inicial (sem filtrar dados por usuário), siga a opção A: extrair o corpo para

integracao._status_faturamento_core(p_mes), mantendo a função pública com a guarda

e chamando o core — comportamento idêntico. Mostre o diff e um teste comparando a

saída antes/depois para um usuário logado. Se houver lógica por usuário, fique na

opção C nesta fase.

Reapresente o SQL completo revisado e o resultado do item 1 para nova aprovação.