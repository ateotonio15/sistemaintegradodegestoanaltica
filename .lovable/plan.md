## Objetivo

Adicionar um toggle expansível em cada linha da tabela na página de Reajuste (`src/pages/Reajustes.tsx`) que, ao ser aberto, mostra dois cards lado a lado (Enfermaria e Apartamento) com os detalhes de valores. Nada da estrutura atual (colunas, filtros, KPIs, ações, status, cálculos) será alterado.

## Alterações

Arquivo único: `src/pages/Reajustes.tsx`

1. **Estado de expansão**
   - Adicionar `const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())` para rastrear quais empresas estão expandidas.
   - Função `toggleExpand(empresaId)` que alterna o id no Set.

2. **Coluna do toggle**
   - Adicionar nova `<TableHead className="w-10" />` como primeira coluna do header (sem alterar as demais).
   - Em cada `<TableRow>` da empresa, adicionar primeira `<TableCell>` com `<Button size="icon" variant="ghost">` exibindo `ChevronRight` (fechado) ou `ChevronDown` (aberto), com `transition-transform`.
   - Atualizar `colSpan={11}` da linha "Nenhum contrato encontrado" para `colSpan={12}`.

3. **Linha expansível (sub div)**
   - Após cada `<TableRow>` da empresa, renderizar condicionalmente uma segunda `<TableRow>` quando `expandedIds.has(empresa.id)`:
     ```tsx
     <TableRow className="bg-muted/30 hover:bg-muted/30">
       <TableCell colSpan={12} className="p-0">
         <div className="animate-accordion-down overflow-hidden">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
             {/* Card Enfermaria */}
             {/* Card Apartamento */}
           </div>
         </div>
       </TableCell>
     </TableRow>
     ```
   - Renderização condicional garante lazy render (só monta quando aberto).

4. **Cards Enfermaria e Apartamento**
   - Componente inline reutilizável `<DetalheCard titulo="Enfermaria" icon={...} valorAtual valorReajustado retroativo valorFinal percentual />`.
   - Cada card: `<Card>` com header (título + badge do percentual) e grid 2x2 / lista com labels e valores formatados via `formatCentavosBRL`.
   - Itens: Valor Atual, %, Valor Reajustado, Retroativo, Valor Final (Valor Final em destaque com `text-primary font-bold`).
   - Quando não há `reajuste` ou está em status `solicitado` sem valores, mostrar placeholder "Sem valores registrados".

5. **Fonte de dados**
   - Usar campos já existentes em `reajustes_anuais` (já carregados via `select("*")`):
     - Enfermaria: `valor_antigo_enfermaria_centavos`, `valor_reajustado_enfermaria_centavos`, `valor_retroativo_enfermaria_centavos`, `valor_final_enfermaria_centavos`.
     - Apartamento: `valor_antigo_apartamento_centavos`, `valor_reajustado_apartamento_centavos`, `valor_retroativo_apartamento_centavos`, `valor_final_apartamento_centavos`.
   - Percentual único: `reajuste.percentual` (mesmo para os dois cards).

6. **Ícones**
   - Importar `ChevronRight`, `ChevronDown`, `BedDouble` (Enfermaria) e `Hotel` (Apartamento) de `lucide-react`.

## Comportamento

- Fechado por padrão; tabela permanece idêntica visualmente.
- Clique no chevron expande/colapsa inline com animação `accordion-down`.
- Responsivo: cards lado a lado no desktop (`md:grid-cols-2`), empilhados no mobile (`grid-cols-1`).
- Sem modal, sem alteração de filtros, status, ações, cálculos ou queries.

## Não fazer

- Não alterar colunas existentes, filtros, KPIs, ordem, ações, status ou queries.
- Não criar novas tabelas ou migrations.
- Não tocar em `ReajusteDialog`, `SolicitarReajusteDialog` ou utilitários de cálculo.
