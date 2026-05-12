## Etapa 30 — Separar valores por modalidade na Faixa Etária

Escopo: corrigir cálculo/exibição em `src/components/reajustes/ReajusteDialog.tsx`, `src/components/reajustes/ReajusteFaixaEtariaTable.tsx` e ajustar o trigger `trg_reajuste_calc_campos` para que, quando `usa_faixa_etaria_*` estiver ativo, o backend não sobrescreva os valores por modalidade calculados no front. Nada muda em outras telas.

### 1. Dialog — painel de resumo (sem somar Enf + Apt)

Atualmente o bloco "Valor reajustado/retroativo/final cobrança" soma as duas modalidades. Substituir por dois cards lado a lado (`grid-cols-1 md:grid-cols-2`):

```text
┌── Enfermaria (badge verde) ──┐ ┌── Apartamento (badge azul) ──┐
│ Valor atual:     R$ ...      │ │ Valor atual:     R$ ...       │
│ Reajustado:      R$ ...      │ │ Reajustado:      R$ ...       │
│ Retroativo:      R$ ...      │ │ Retroativo:      R$ ...       │
│ VALOR FINAL:     R$ ...      │ │ VALOR FINAL:     R$ ...       │
└──────────────────────────────┘ └───────────────────────────────┘
```

- Renderizar apenas o card da modalidade marcada (`possuiEnf` / `possuiApt`).
- Manter o "Mês oficial de reajuste" e "Meses retroativos" no topo.
- Remover variáveis `valorAntigoCent` / `valorReajustadoCent` / `retroativoCent` / `valorFinalCent` da exibição (continuar calculando só para popular os campos legados no payload — retrocompatibilidade da listagem).

### 2. Dialog — layout das duas modalidades lado a lado

O bloco que renderiza Enfermaria e Apartamento (linhas 337–399 atuais) passa a usar `grid grid-cols-1 lg:grid-cols-2 gap-3` quando ambas estiverem ativas. Cada tabela `ReajusteFaixaEtariaTable` ocupa uma coluna; quando só uma modalidade ativa, ocupa a largura total.

Aumentar a largura do `DialogContent` para `max-w-5xl` para acomodar as duas tabelas.

### 3. Tabela de faixas

Pequenos ajustes em `ReajusteFaixaEtariaTable.tsx`:
- Reduzir colunas em telas estreitas: manter `Faixa | Atual | % | Final` em mobile, mostrar `Reajustado` e `Retroativo` apenas em `md:`.
- Rodapé "Total" do bloco continua local da própria modalidade (não some com a outra).

### 4. Trigger no banco — preservar valores quando usar faixa etária

O trigger `trg_reajuste_calc_campos` recalcula `valor_reajustado_<mod>_centavos` usando `NEW.percentual` × `valor_antigo_<mod>`. Isso quebra cenários com percentuais por faixa (cada faixa pode ter % diferente). Ajuste:

- Se `NEW.usa_faixa_etaria_enfermaria = true`, não recalcular `valor_reajustado_enfermaria_centavos`, `valor_retroativo_enfermaria_centavos` nem `valor_final_enfermaria_centavos` — manter exatamente o que o dialog enviou (somatório das faixas).
- Mesma regra para `usa_faixa_etaria_apartamento`.
- Quando faixa etária está ativa nas duas, recalcular os campos legados (`valor_antigo_centavos`, `valor_reajustado_centavos`, `valor_retroativo_centavos`, `valor_final_centavos`) como soma das duas modalidades (apenas para retrocompatibilidade dos selects existentes).

Nada muda no comportamento atual quando `usa_faixa_etaria_*` é false.

### 5. Listagem (página `Reajustes.tsx`)

Sem mudanças funcionais. Já existe lógica que prioriza Enfermaria na coluna resumo e o painel expandido já exibe os dois blocos separados (linhas 468–490). Apenas confirmar visualmente que continua correto após as mudanças do dialog.

### O que NÃO muda

- Estrutura da tabela `reajuste_faixas` (já tem `modalidade`, `idade_inicial`, `idade_final` e valores próprios).
- Colunas `valor_antigo_<mod>_centavos` / `valor_final_<mod>_centavos` da `reajustes_anuais` (já existem).
- Fluxo de status, alertas de reajuste, RLS, retroativos, regras da aba Financeiro.
- Reajustes já cadastrados (campos legados continuam preenchidos).

### Resumo das alterações

- `src/components/reajustes/ReajusteDialog.tsx` — painel de resumo separado em dois cards; layout grid 2 colunas para as modalidades; `DialogContent` mais largo.
- `src/components/reajustes/ReajusteFaixaEtariaTable.tsx` — pequenos ajustes responsivos (sem mudar lógica).
- Migração SQL — versão atualizada de `trg_reajuste_calc_campos` que respeita `usa_faixa_etaria_*` e não sobrescreve valores por modalidade.
