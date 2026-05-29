# Plano: Configurações Financeiras da Empresa + gate em "Iniciar faturamento"

## 1. Banco de dados (migração)

Adicionar à tabela `empresas` apenas o que ainda não existe (campos atuais reaproveitados: `data_emissao_fatura`, `data_vencimento_fatura`, `pagamento_via_deposito`, `tipo_financeiro`):

- `exige_po_pc` boolean NOT NULL DEFAULT false
- `email_financeiro_cliente` text
- `observacao_padrao_financeiro` text
- `regra_prorrogacao` text
- `exige_relatorio_antes_nota` boolean NOT NULL DEFAULT false

Forma de pagamento será derivada de `pagamento_via_deposito` (false = DDA, true = Depósito) — sem coluna nova, mantendo compatibilidade com o que já existe no Financeiro/Dashboard.

Pagadores continuam em `financeiro_pagadores` (já existe CRUD via `GerenciarPagadoresDialog`); o modal só linkará para essa tela.

## 2. Função utilitária de validação

Criar `src/lib/empresa-financeiro-config.ts` com:

- tipo `EmpresaFinanceiroConfig` (campos obrigatórios + complementares)
- `validarConfigFinanceira(empresa)` → retorna `{ ok: boolean, faltantes: string[] }`
- Obrigatórios: `data_emissao_fatura`, `pagamento_via_deposito` (sempre definido, mas exigir confirmação explícita uma vez via flag — ver passo 5), `data_vencimento_fatura`, `exige_po_pc` (confirmado), `tipo_financeiro`

Para diferenciar "nunca configurado" vs "default DDA", adicionar coluna `config_financeira_confirmada` boolean NOT NULL DEFAULT false na migração. Quando true, considera-se que o usuário já validou as configurações.

## 3. Modal "Configurações Financeiras da Empresa"

Novo componente `src/components/financeiro/ConfigFinanceiraEmpresaDialog.tsx`:

- Título + subtítulo conforme spec
- **Bloco 1 — Obrigatórios** (com `*` e mensagens de erro inline via zod):
  - Data de emissão (number 1–31, reusa `data_emissao_fatura`)
  - Forma de pagamento (Select DDA/Depósito → grava `pagamento_via_deposito`)
  - Dia padrão de vencimento (number 1–31 → `data_vencimento_fatura`)
  - Exige PO/PC? (Sim/Não → `exige_po_pc`)
  - Tipo (Select usando `TIPOS_FINANCEIRO` de `financeiro-utils.ts` → `tipo_financeiro`)
- **Bloco 2 — Complementares**:
  - Pagadores vinculados (botão "Gerenciar" abre `GerenciarPagadoresDialog` existente)
  - E-mail financeiro do cliente
  - Observação padrão
  - Regra de prorrogação
  - Exige relatório antes da nota? (Sim/Não)
- **Botões**: Cancelar | Salvar e iniciar faturamento
- Mostra avisos quando PO/PC = Sim ou relatório = Sim

Ao salvar:
1. `UPDATE empresas` com todos os campos + `config_financeira_confirmada = true`
2. Invalida queries de empresas
3. Chama callback `onConfirm()` que retoma o fluxo de iniciar faturamento

## 4. Gate no "Iniciar faturamento"

Em `src/components/financeiro/FinanceiroTable.tsx` (handler do botão) e/ou `src/pages/Financeiro.tsx`:

```text
onClick Iniciar:
  cfg = validarConfigFinanceira(empresa)
  if (!cfg.ok || !empresa.config_financeira_confirmada):
      abrir ConfigFinanceiraEmpresaDialog(empresa, onConfirm = iniciarFaturamentoReal)
  else:
      iniciarFaturamentoReal()
```

`iniciarFaturamentoReal` = lógica atual que grava `faturamento_iniciado_em/_por/_por_nome`.

Se `exige_po_pc = true`, após iniciar faturamento exibir toast/banner de aviso ("Esta empresa exige PO/PC...") e bloquear a ação "Enviar nota" / `data_envio_nota` enquanto não houver confirmação de envio prévio. Implementação mínima: marcar visualmente no `FinanceiroTable` (badge "PO/PC obrigatório") e adicionar checagem no botão de envio de nota com mensagem.

Se `exige_relatorio_antes_nota = true`, mesmo tratamento de aviso ao iniciar e badge.

## 5. Seção "Configurações Financeiras" no cadastro da Empresa

Em `src/pages/Empresas.tsx` (form de edição da empresa), adicionar nova seção colapsável "Configurações Financeiras" com os mesmos campos do modal (reutilizando o componente em modo "inline" via prop `mode: 'inline' | 'modal'`), permitindo consulta/edição a qualquer momento.

## 6. Compatibilidade — nada é removido

Mantidos sem alteração: anexos, análise Excel×PDF, geração de histórico, boleto DDA, pagamento via depósito (passa a ser controlado também pelo modal), prorrogação, cobrança retroativa, pagadores, exportação, status financeiro.

## Detalhes técnicos

- Validação client com `zod` (já presente nas guidelines de segurança).
- Tipos atualizados automaticamente em `src/integrations/supabase/types.ts` após migração.
- Query keys de React Query a invalidar: `["empresas"]`, `["financeiro-empresas"]`, e qualquer cache que dependa de `pagamento_via_deposito` / `tipo_financeiro`.
- Não tocar em RLS — colunas novas herdam policies existentes da tabela `empresas`.

## Arquivos a criar/editar

- **Migração nova** (add colunas em `empresas`)
- **Criar** `src/lib/empresa-financeiro-config.ts`
- **Criar** `src/components/financeiro/ConfigFinanceiraEmpresaDialog.tsx`
- **Editar** `src/components/financeiro/FinanceiroTable.tsx` (gate + badges PO/PC, relatório)
- **Editar** `src/pages/Financeiro.tsx` (estado do dialog + retomada do fluxo)
- **Editar** `src/pages/Empresas.tsx` (seção Configurações Financeiras no form)
