## Etapa 31 — Reorganizar a janela de Reajuste em abas

Reescrever apenas o layout do `ReajusteDialog` (e adicionar uma nova variante "card" da tabela de faixas). Toda a lógica de cálculo, payload, mutation, faixas, RLS e o trigger ficam exatamente como estão.

### 1. Estrutura geral do modal

- `DialogContent` passa para `max-w-[1280px] w-[95vw] p-0 max-h-[92vh] flex flex-col` (sem scroll na própria janela).
- Estrutura em 3 áreas verticais:
  - **Header fixo**: título + subtítulo (nome da empresa, ano, badge do status).
  - **Conteúdo rolável** (`flex-1 overflow-y-auto px-6 py-5`): conteúdo da aba ativa.
  - **Footer fixo** (`border-t bg-background px-6 py-3`): botões Cancelar / Salvar (rótulo já muda para "Atualizar" quando `editing`).
- Substituir o scroll interno do modal pelo scroll desta área central.

### 2. Tabs

Usar `Tabs` do shadcn (`@/components/ui/tabs`) já disponível no projeto. 4 abas:

```text
[ Informações Gerais ] [ Enfermaria ] [ Apartamento ] [ Resumo ]
```

- Abas Enfermaria/Apartamento ficam desabilitadas quando a modalidade não está marcada (com tooltip "Marque a modalidade na aba Informações Gerais").
- Conteúdo só renderiza quando a aba está ativa (`TabsContent` já faz isso) — atende ao item 14 (performance).
- Badge ao lado do label da aba indicando "Faixa Etária" quando `usaFaixa*` está ativo, e um pequeno indicador `●` quando há valor preenchido.

### 3. Aba "Informações Gerais"

Grid `md:grid-cols-2 gap-5`. Campos com `h-11` (inputs maiores) e labels com `text-sm font-medium`.

- Contrato (Select)
- Ano do reajuste
- Data de aplicação
- Percentual padrão
- Modalidades (`ModalidadesPicker` atual)
- Observação (`Textarea`, ocupa 2 colunas)

Bloco lateral/abaixo (`rounded-lg border bg-muted/30 p-4`) com 2 cards informativos pequenos: "Mês oficial de reajuste" e "Meses retroativos".

### 4. Abas Enfermaria e Apartamento

Cada aba ocupa toda a largura (sem mais grid 2 colunas lado a lado).

Cabeçalho da aba:
- Título grande com ícone (`BedDouble` verde / `Hotel` azul).
- Switch "Contrato com faixa etária".
- Quando faixa etária ON e percentual único OFF: mostrar pequena linha-resumo com Atual / Reajustado / Retroativo / Final acumulados.

Conteúdo:

- **Sem faixa etária**: card único com input grande de Valor Atual e os 4 valores calculados em quadradinhos abaixo.
- **Com faixa etária**: substituir a tabela atual pela nova `ReajusteFaixaEtariaCards` (ver §5). Sem scroll interno — todas as faixas são renderizadas verticalmente e o scroll usa o do modal.

### 5. Novo componente `ReajusteFaixaEtariaCards`

Novo arquivo `src/components/reajustes/ReajusteFaixaEtariaCards.tsx`. Mesma API/props da `ReajusteFaixaEtariaTable` (mantém a tabela antiga por enquanto, ainda exportada para retrocompat).

Cada faixa vira um card:

```text
┌──────────────────────────────────────────────────────────┐
│ Faixa 0 - 18 anos                          [badge cor]   │
├──────────────────────────────────────────────────────────┤
│ Valor Atual    %       Reajustado   Retroativo   Final   │
│ [input R$ ]   [%]      R$ ...        R$ ...      R$ ...  │
└──────────────────────────────────────────────────────────┘
```

- Grid interno `md:grid-cols-5 gap-3`, mobile empilha em 2 colunas.
- Inputs `h-10` com `inputMode="decimal"` e máscara visual já existente (`reaisToCentavos`).
- Quando "percentual único" está ativo, o campo `%` mostra desabilitado com o valor global.
- Toggle "Usar percentual único" no topo do bloco da aba.
- Ao final, card-resumo da modalidade (Atual / Reajustado / Retroativo / Final) com tipografia maior.

### 6. Aba "Resumo"

Cards premium um do lado do outro (`md:grid-cols-2`):

- Card Enfermaria (verde): Valor Atual, Reajustado, Retroativo, Valor Final, total de faixas com valor (`faixasEnf.filter(...).length`).
- Card Apartamento (azul): mesmo padrão.
- Abaixo, faixa horizontal com 4 mini-cards informativos: Mês oficial, Meses retroativos, Percentual aplicado, Data de aplicação.
- Bloco de observação (somente leitura) renderizado se preenchido.

Importante: **não somar Enfermaria e Apartamento** em nenhum lugar (etapa anterior já estabeleceu isso).

### 7. Footer fixo

`DialogFooter` reposicionado para ficar dentro do flex-column como rodapé fixo:

```text
[ Cancelar ]  [ < Voltar ] [ Avançar > ]   [ Salvar ]
```

- "Voltar" / "Avançar" navegam entre abas (desabilitados nos extremos e pulam abas desabilitadas).
- "Salvar" aciona a mesma `mutation.mutate()` atual.

### 8. Pequenos detalhes visuais

- Tipografia: títulos de seção em `text-base font-semibold` com pequeno `text-muted-foreground` de apoio.
- Divisores suaves (`border-border/60`), `rounded-xl`, `bg-card/80`, sombras sutis (`shadow-sm`).
- Badges modernos para faixas (`bg-emerald-500/15 text-emerald-700 border-emerald-500/30` e equivalente azul).
- Animações leves: `animate-fade-in` nas trocas de aba.
- Inputs: `focus-visible:ring-2 ring-primary/30 transition`.

### 9. O que não muda

- `mutation`, validações, payload, sincronização de `reajuste_faixas`, gravação dos campos legados.
- `ReajusteFaixaEtariaTable` continua existindo (não é removido) — apenas deixa de ser usado pelo dialog.
- Trigger do banco e RLS.
- Página `Reajustes.tsx` (listagem).
- `ModalidadesPicker` (reaproveitado).

### 10. Resumo das mudanças de arquivos

- `src/components/reajustes/ReajusteDialog.tsx` — reescrita do JSX (mantendo toda a lógica/hooks/`mutation`).
- `src/components/reajustes/ReajusteFaixaEtariaCards.tsx` — novo arquivo, alternativa em cards à tabela.
