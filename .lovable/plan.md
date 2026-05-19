# ETAPA 42 — Dashboard de Implantações

Substituir o card "Faturamentos Não Enviados" no Dashboard por um painel "Implantações em Andamento", e mover a função antiga para a aba Movimentações, sem perder dados nem regras existentes.

## 1. Dashboard — Novo painel "Implantações em Andamento"

Novo componente `src/components/dashboard/ImplantacoesAndamentoCard.tsx` substituindo `<FaturamentosEnviadosCard />` em `src/pages/Dashboard.tsx` (linha 798).

Visual estilo Linear, dark green premium, com:

- Header com KPIs: total em implantação, aguardando diretoria, em correção, atrasadas, total de vidas.
- Lista/grid de contratos em implantação, cada card mostrando:
  - Nome da empresa + código do contrato
  - Responsável (Diretora — `aprovado_por_nome` / `created_by_nome` quando aplicável)
  - Data de início (`inicio_atendimento`), última atualização (`updated_at`), prazo (`data_vigencia`)
  - Status com badge colorido (usa `STATUS_META` de `src/lib/implantacao-status.ts`)
  - Etapa atual (`etapa_atual` / 7) e pendências (alertas abertos em `implantacao_alertas`)
  - Total de vidas (`total_vidas`), titulares, dependentes; quando disponível, vidas ativas/aguardando/processadas vindas de `relatorio_validacao`
  - Barra de progresso (`progresso` 0–100) com cor: verde ≥80, amarelo 40–79, vermelho <40 ou atrasado
- Timeline horizontal compacta por card: criação → envio diretoria → aprovação → cadastro → implantado (usa `created_at`, `enviado_diretoria_em`, `aprovado_em`, `enviado_cadastro_em`, `implantado_em`).
- Indicador de pendências (badge com contagem de alertas pendentes do contrato).
- Alertas visuais: implantação atrasada (prazo vencido), documento faltando, aguardando diretoria, aguardando cadastro.

Filtros (toolbar do painel):
- Responsável (diretora aprovador)
- Mês (do `created_at` ou `inicio_atendimento`)
- Status (multiselect com os enums)
- Empresa (busca por nome/CNPJ/contrato)
- Faixa de vidas (slider/select: <50, 50–200, 200–500, 500+)

Fonte de dados:
- Tabela `implantacoes_contratos` (filtrar status ≠ `implantado` e ≠ `rejeitado` por padrão; toggle "mostrar concluídos").
- Tabela `implantacao_alertas` (contagem de pendências por `implantacao_id`, `status='Pendente'`).
- Permissões já cobertas por RLS atuais (admin, comum, vendas, diretora, visualizacao).

## 2. Mover "Faturamentos Não Enviados" para Movimentações

- Remover `<FaturamentosEnviadosCard />` e seu import do `Dashboard.tsx`.
- Manter o arquivo `src/components/dashboard/FaturamentosEnviadosCard.tsx` (renderizado em outro local) — não apagar lógica.
- Em `src/pages/Movimentacoes.tsx`, adicionar nova seção "Faturamentos Não Enviados" no topo (ou em uma nova aba interna `Tabs`), renderizando o mesmo `FaturamentosEnviadosCard` sem alterações de regras, filtros, alertas, status ou períodos.

## 3. Sem alterações em

- Regras financeiras, RPCs, RLS de movimentações/financeiro.
- Schema do banco (nenhuma migration necessária — todos os campos já existem em `implantacoes_contratos` e `implantacao_alertas`).
- Wizard de implantação, fluxo Vendas → Diretora → Cadastro já existente.

## Detalhes técnicos

- Novos arquivos: `src/components/dashboard/ImplantacoesAndamentoCard.tsx` (+ subcomponentes opcionais: `ImplantacaoRowCard`, `ImplantacaoMiniTimeline`, `ImplantacoesFilters`).
- Edits: `src/pages/Dashboard.tsx` (substituir o card), `src/pages/Movimentacoes.tsx` (adicionar seção/aba reutilizando `FaturamentosEnviadosCard`).
- React Query: nova chave `["implantacoes-andamento", filters]` + `["implantacao-alertas-count"]`; invalidar quando workflow muda status.
- Status badges reaproveitam `STATUS_META` já existente.
- Acessível via perfis: admin, comum (cadastro), diretora, vendas, visualizacao — consistente com RLS já aplicadas.

## Não fazer

- Não apagar `FaturamentosEnviadosCard.tsx` nem alterar suas regras.
- Não criar migration nova.
- Não mexer no fluxo de aprovação/correção da diretoria.
