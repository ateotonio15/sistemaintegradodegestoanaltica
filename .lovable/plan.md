## Etapa 19 — Reajuste Duplo (Enfermaria e Apartamento)

Adicionar campos separados para Enfermaria e Apartamento na aba Reajuste, mantendo um único percentual aplicado a ambos. Preserva os campos legados (`valor_antigo_centavos`, `valor_reajustado_centavos`, etc.) para histórico/compatibilidade — eles passam a refletir o total (Enfermaria + Apartamento).

### 1. Banco — Migration

Adicionar à tabela `reajustes_anuais`:

```
valor_antigo_enfermaria_centavos      bigint
valor_reajustado_enfermaria_centavos  bigint
valor_retroativo_enfermaria_centavos  bigint  default 0
valor_final_enfermaria_centavos       bigint  default 0

valor_antigo_apartamento_centavos      bigint
valor_reajustado_apartamento_centavos  bigint
valor_retroativo_apartamento_centavos  bigint  default 0
valor_final_apartamento_centavos       bigint  default 0
```

Atualizar a função `trg_reajuste_calc_campos` para também calcular automaticamente os pares Enfermaria/Apartamento usando o mesmo `percentual` e `meses_retroativos`. Os campos legados de total continuam sendo calculados como soma dos dois (ou mantidos quando só houver valor único, para retrocompatibilidade).

Atualizar `solicitar_reajuste` para inicializar os novos campos com 0.

### 2. Utils (`src/lib/reajuste-utils.ts`)

- Reaproveitar `calcularValorReajustadoCentavos`, `calcularRetroativoCentavos`, `calcularValorFinalCentavos` para os dois blocos.
- Sem nova lógica de cálculo: apenas chamadas duplicadas (Enfermaria/Apartamento) com o mesmo percentual.

### 3. ReajusteDialog

- Substituir o campo único "Valor Atual" por dois campos:
  - **Valor Atual Enfermaria (R$)**
  - **Valor Atual Apartamento (R$)**
- Manter um único campo **Percentual (%)**.
- Preview em **dois cards lado a lado** (Enfermaria e Apartamento), cada um mostrando: Valor Atual, %, Valor Reajustado, Retroativo (com nº meses), Valor Final destacado.
- Mês oficial e meses retroativos exibidos uma única vez acima dos cards.
- Payload de insert/update grava todos os 8 novos campos. Campos legados (`valor_antigo_centavos`, `valor_reajustado_centavos`) recebem a **soma** Enfermaria + Apartamento para não quebrar telas existentes (Dashboard, Financeiro, Histórico).

### 4. Tabela em `Reajustes.tsx`

Substituir as colunas "Valor Atual / % / Valor Reajustado / Retroativo / Valor Final" por colunas mais enxutas:

```
Empresa | Contrato | Implantação | Mês Reajuste | %
| Enfermaria (Final) | Apartamento (Final) | Status | Ações
```

- Colunas Enfermaria/Apartamento exibem o **Valor Final** em destaque, com o valor reajustado em texto pequeno abaixo.
- Botão **"Detalhes"** (ícone) abre um popover/dialog com o breakdown completo dos dois cards (Atual, %, Reajustado, Retroativo, Final).
- Botões existentes (Liberar, Editar, Excluir, Solicitar) preservados.

### 5. Detalhes — novo componente leve

`ReajusteDetalhesDialog.tsx` exibindo os dois cards (Enfermaria/Apartamento) em layout idêntico ao preview do dialog de edição, somente leitura.

### 6. Histórico

`ReajusteHistoricoDialog` passa a listar, por linha do histórico, os pares Enfermaria e Apartamento (Valor Antigo → Reajustado → Retroativo → Final), além do total para retrocompatibilidade.

### 7. Formatação

Todos os valores usam `formatCentavosBRL` (já em pt-BR, R$ X.XXX,XX). Valores nulos exibem "—".

### O que NÃO será feito

- Não alterar RLS de `reajustes_anuais`.
- Não criar percentuais separados.
- Não remover os campos legados (`valor_antigo_centavos`, `valor_reajustado_centavos`, `valor_retroativo_centavos`, `valor_final_centavos`) — eles continuam preenchidos como soma para não quebrar Dashboard/Alertas.
- Não tocar em `AlertaReajustesPendentes`, `AlertaReajustesParaConfirmar`, fluxo de solicitação ou triggers de alerta — todo o fluxo de status permanece igual.
