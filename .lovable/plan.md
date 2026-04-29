## Objetivo

Evoluir a aba **Financeiro** para suportar contratos com múltiplos pagadores (ex: contrato 2451 com FE COMERCIO e EF COMERCIO), com sincronização automática controlada por confirmação do usuário.

---

## 1. Modelo de dados (sem nova tabela)

Aproveitar `empresas.codigo_contrato` como chave de agrupamento. Pagadores irmãos = empresas que compartilham o mesmo `codigo_contrato`.

- **Contrato** = grupo de empresas com o mesmo `codigo_contrato`.
- **Pagador** = cada `empresa` individual (com seu próprio CNPJ).
- Sem migração de dados existentes; apenas uma view/agregação no frontend.

---

## 2. Importação de pagadores via Excel

Nova tela / botão **"Importar pagadores"** na aba Financeiro (e/ou Empresas).

Formato do Excel (igual ao enviado):

| Empresa | Contrato | CNPJ |
|---|---|---|
| FE COMERCIO | 2451 | (vazio) |
| EF COMERCIO | 2451 | 04.967.477/0001-00 |

Comportamento:
- Para cada linha, busca empresa pelo nome + `codigo_contrato`.
- Se não existir, cria nova empresa com `nome`, `codigo_contrato`, `cnpj` e copia configuração (tipo_movimentacao, periodo, etc.) do primeiro pagador já existente do mesmo contrato.
- Se existir, apenas atualiza CNPJ se estiver vazio.
- Toast com resumo: X criados, Y atualizados, Z ignorados.

---

## 3. Sincronização entre pagadores (com confirmação)

Quando o usuário salvar, no diálogo "Editar movimentação" do Financeiro, qualquer um destes campos:
- `data_envio_nota`
- `data_vencimento` (dia)
- `dia_emissao`
- `tipo_analise`
- `tipo_cobranca`
- `dentro_prazo`
- ou subir/excluir anexo

**E** o contrato tiver mais de um pagador, o sistema abre um modal de confirmação:

> "O contrato 2451 tem 2 pagadores (FE COMERCIO, EF COMERCIO). Deseja aplicar esta alteração para **todos os pagadores** do contrato?"
>
> [Aplicar a todos] [Apenas neste pagador] [Cancelar]

- "Aplicar a todos" → replica nos `financeiro_movimentacoes` dos demais pagadores (mesmo `mes_referencia` + `periodo`), criando o registro se não existir. Anexos são copiados via referência (mesmo `storage_path`).
- "Apenas neste pagador" → comportamento atual.
- A confirmação só aparece quando há ≥2 pagadores no contrato.

---

## 4. KPIs no topo do Financeiro

- **Remover** o card "Anexos" (Paperclip, valor 13 no print).
- **Adicionar** card **"Total de Pagadores"** = contagem distinta de empresas que aparecem no período filtrado.
- Manter "Total empresas" como está (o usuário pediu para manter — corresponde a contratos/linhas atuais; o nome pode permanecer).

---

## 5. Visualização de pagadores no Financeiro

Na tabela do Financeiro, contratos com múltiplos pagadores ganham:
- Ícone "grupo" (Users) ao lado do nome do contrato.
- Linha expansível (chevron) que mostra os pagadores irmãos (Nome + CNPJ).
- Filtro adicional: "Filtrar por pagador" (multiselect com nomes).

A linha principal continua representando o contrato; a expansão é informativa.

---

## 6. Mudanças técnicas

### Frontend
- `src/components/financeiro/KpiCards.tsx`: remover entrada `totalAnexos`, adicionar `totalPagadores`.
- `src/pages/Financeiro.tsx`: calcular `totalPagadores`, agrupar `kpiRows` por `codigo_contrato` para exibição expansível, remover `totalAnexos` do retorno do `useMemo`.
- `src/components/financeiro/FinanceiroTable.tsx`: adicionar coluna/expansão de pagadores irmãos quando contrato tem >1 empresa.
- `src/components/financeiro/EditarMovimentacaoDialog.tsx`: adicionar diálogo de confirmação de replicação ao salvar/anexar quando o contrato tiver múltiplos pagadores. Função utilitária `replicateToSiblings(contratoId, payload)`.
- Novo componente `src/components/financeiro/ImportPagadoresDialog.tsx`: lê XLSX (lib `xlsx` já presente), faz upsert de empresas via Supabase.
- Novo botão "Importar pagadores" no header da página Financeiro.

### Backend / Banco
- **Sem migração de schema**. Toda lógica de agrupamento e replicação fica no cliente (RLS atual já permite financeiro/admin fazer upsert em `financeiro_movimentacoes` e `anexos_financeiro`).
- Função utilitária no front: `getPagadoresDoContrato(codigo_contrato)` → consulta `empresas` filtrando por `codigo_contrato`.

### Compatibilidade
- Contratos com 1 pagador continuam funcionando exatamente como hoje (nenhuma confirmação aparece).
- Estrutura existente de `financeiro_movimentacoes` (uma por empresa+mes+periodo) é preservada — replicação cria registros equivalentes nos pagadores irmãos.

---

## 7. Fora de escopo (futuro)

- Inadimplência por pagador.
- Histórico de quem replicou/alterou.
- Bloqueio de exclusão de pagador com movimentações.
