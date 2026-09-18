# Regra de competência do vencimento (Editar Empresa)

## Objetivo
Permitir escolher, por empresa, em qual mês o vencimento deve cair em relação à competência do faturamento anexado:

- **Mês anterior** — faturamento de outubro, vencimento dia 25 → 25/09
- **Mês atual (padrão de hoje)** — → 25/10
- **Mês posterior** — → 25/11

## O que muda na tela
Na aba **Editar Empresa**, no bloco "Datas & Faturamento", ao lado de "Dia Vencimento Fatura (1-31)" entra um novo campo **Competência do Vencimento** com as três opções. Padrão para todas as empresas existentes: **Mês atual**, mantendo exatamente o comportamento atual de quem não mexer na configuração.

Junto ao campo, um texto curto de ajuda mostrando o exemplo do dia escolhido (ex.: "Faturamento de Outubro → vence em 25/09").

## Onde a regra passa a valer
O deslocamento é aplicado sempre que o sistema monta a data de vencimento a partir da competência do faturamento:

1. Geração do histórico/observação da nota (linha "Data de vencimento: ...").
2. Gravação do vencimento na movimentação do Financeiro (dia escolhido + competência).
3. Provisionamento em lote de novas competências, que hoje copia o vencimento mantendo o mesmo dia.

Regras de borda: o dia é limitado ao último dia do mês resultante (ex.: dia 31 em fevereiro → 28/29); a virada de ano é tratada (competência janeiro + mês anterior → dezembro do ano anterior). Prorrogação manual continua tendo prioridade — quando o usuário informa a data de prorrogação, ela não é deslocada. Empresas com período específico de cobrança continuam tendo o mês-base derivado do período, e o deslocamento é aplicado sobre esse mês-base.

## Detalhes técnicos
- Migração: coluna `vencimento_competencia TEXT NOT NULL DEFAULT 'atual'` em `public.empresas`, com `CHECK (vencimento_competencia IN ('anterior','atual','posterior'))`.
- Nova função utilitária em `src/lib/historico-utils.ts`: `aplicarOffsetCompetencia(mes0, ano, regra)` retornando `{ mes0, ano }`; `calcularVencimentoPadrao` ganha parâmetro opcional da regra e faz o clamp do dia.
- `src/pages/Empresas.tsx`: novo estado/Select no formulário de edição, incluído no `select` da query, no carregamento (`openEdit`) e no payload de salvamento.
- `src/components/financeiro/GerarHistoricoDialog.tsx`: `calcularVencimentoBR` aplica a regra ao par `mesBase/anoBase` (inclusive quando vem do período específico).
- `src/components/financeiro/EditarMovimentacaoDialog.tsx`: `buildPayload` monta `data_vencimento` a partir do mês deslocado em vez de usar `mes_referencia` direto.
- `src/pages/Financeiro.tsx`: `buildVencimentoNovo` no provisionamento usa a mesma função, buscando a regra da empresa junto das demais configs.
- `src/lib/empresa-financeiro-config.ts`: tipo e schema ganham o campo (opcional, default `'atual'`).
- Nenhuma permissão, RLS ou fluxo existente é alterado; empresas sem configuração seguem idênticas ao comportamento atual.
