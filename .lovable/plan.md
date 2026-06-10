# Módulo "Carteira Samel" no CS Control

Adiciona um novo módulo `/carteira-samel` reaproveitando o login Supabase atual e a sidebar do CS Control. Nenhuma alteração na identidade visual nem nos módulos existentes.

## 1. Navegação

Adicionar no `src/components/AppLayout.tsx` um item de menu **"Carteira Samel"** (ícone `Briefcase`), com subitens que aparecem dentro do mesmo padrão dos demais (mesmo estilo verde/dark do CS Control — sem sidebar paralela):

- Visão Geral · Carteira · Sinistralidade · Score de Risco · Avaliações RH

Visível para `admin`, `diretora`, `comum`, `executivo`. Demais perfis não veem.

## 2. Banco (Lovable Cloud)

Migração criando 6 tabelas com prefixo `cs_` para não colidir com nada existente:

- `cs_sinistralidade_historico` (empresa, contrato, mês/ano, sinistralidade %, % reajuste, indexador, observação, created_by)
- `cs_sinistralidade_mensal` (empresa_id, mes/ano, sinistralidade %, reajuste %)
- `cs_avaliacao_risco` (semáforos por dimensão, pontuação_total, classificação_final)
- `cs_avaliacoes_executiva` (relacionamento, satisfação, observação, created_by)
- `cs_avaliacao_formularios` (tipo, título, instruções, perguntas jsonb)
- `cs_avaliacao_respostas` (formulario_id, respondente, respostas jsonb)

Todas com GRANT para `anon` e `authenticated` + RLS aberta (`USING (true)` para SELECT/INSERT/UPDATE), conforme especificado. `cs_avaliacao_formularios` e `cs_avaliacao_respostas` permitem `anon` para que o link público de resposta funcione sem login.

## 3. Carteira (mock em memória)

`src/modules/carteira-samel/context/EmpresasContext.tsx` carrega lista de `src/modules/carteira-samel/data/mockData.ts` (~15 empresas exemplo). `add/update/inativar` somente em memória.

## 4. Regras de risco

- `src/modules/carteira-samel/lib/risco.ts` — semáforos sinistralidade/renovação, score 5 dimensões (5–15), próximo aniversário do contrato.
- `src/modules/carteira-samel/lib/analiseContrato.ts` — comparativo entre 2 períodos (média, meses >100%, mês pico, distorção acumulada) com classificação melhorou/piorou/estável e geração dos 3 blocos de texto.

## 5. Páginas (sob `/carteira-samel/...`)

| Rota | Conteúdo |
|---|---|
| `/carteira-samel` | Visão Geral — 4 KPIs, alerta reajustes 3 faixas clicáveis, busca individual com painel detalhado |
| `/carteira-samel/carteira` | Tabela de clientes com filtros (grupo/busca), 4 KPIs no topo, ordenação por coluna |
| `/carteira-samel/sinistralidade` | Lista + modal Histórico/Inserir + seção Análise de Contrato (duas TabelaPeriodo + Gerar Análise) |
| `/carteira-samel/score` | Score simplificado 2D, toggle grid/lista, drawer 3 abas (Reclamações stub, Reajuste, Avaliação) |
| `/carteira-samel/avaliacoes/rh` | Editor + link público `${origin}/carteira-samel/avaliacoes/rh/responder/:formId` |
| `/carteira-samel/avaliacoes/rh/responder/:formId` | **Rota pública** (fora do `AppShell`), formulário 5 ratings + 1 textarea, salva em `cs_avaliacao_respostas` |

**Fora do escopo desta entrega:** `/externo` e `/catalog-items` (dependem do Supabase externo, marcados como pendentes).

A aba *Reclamações* no drawer Score exibe placeholder "Conexão externa pendente — configure a base externa para ativar".

## 6. Componentes reutilizáveis

Dentro de `src/modules/carteira-samel/components/`:
- `RatingScale.tsx` (botões 1–5, verde Samel, readOnly opcional)
- `TabelaPeriodo.tsx` (tabela editável com totais e add/remove linha)
- `EmpresaDetailsDrawer.tsx` (3 abas)
- `StatCard.tsx` (KPI)
- `SemaforoBadge.tsx` (Verde/Amarelo/Vermelho com tokens existentes)

**Reutiliza** os tokens/cores do CS Control (sem introduzir `#2D6A4F` — o verde já existe em `--primary`). Sem nova fonte, sem nova sidebar, sem novo header.

## 7. Hook

`useRiscoData` em `src/modules/carteira-samel/hooks/useRiscoData.ts` com as operações listadas no prompt, todas via `supabase` client existente.

## 8. App.tsx

- Rota pública `/carteira-samel/avaliacoes/rh/responder/:formId` registrada **fora** do `AppShell`.
- Demais rotas dentro do `AppShell` (login Supabase atual + AppLayout).
- `RoleGate allow={["admin","diretora","comum","executivo"]}` envolve `/carteira-samel/*`.

## Detalhes técnicos

- Isolamento: todo código novo em `src/modules/carteira-samel/` (exceto rotas em `App.tsx` e 1 item no `AppLayout.tsx`).
- Tipos Supabase: as 6 tabelas aparecem em `src/integrations/supabase/types.ts` automaticamente após a migração.
- Nada do CS Control é renomeado/removido. Sidebar mantém logo CS Control e cor atual.
- Login fixo do prompt **descartado** — usa Supabase auth atual conforme escolhido.
- Base externa **descartada** por enquanto — placeholder na aba Reclamações.

## Arquivos novos
- `supabase/migrations/<ts>_carteira_samel.sql`
- `src/modules/carteira-samel/` (context, data, lib, hooks, components, pages — ~20 arquivos)

## Arquivos editados
- `src/App.tsx` — registra rotas
- `src/components/AppLayout.tsx` — adiciona item de menu com gate de role
