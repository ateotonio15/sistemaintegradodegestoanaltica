# Etapa 48 — Modal "Valores e Faixa Etária" na aba Empresas

## Objetivo
Adicionar um botão na coluna **Ações** da tabela de Empresas que abre um modal premium (somente leitura) com valores do contrato, reajuste mais recente e tabela de faixa etária, sem precisar abrir a aba Reajustes.

## Onde aparece o botão
Coluna **Ações** em `src/pages/Empresas.tsx` (linhas 734–743), antes do botão de editar.

- Ícone: `Wallet` (lucide-react) — representa valores.
- Tooltip: "Valores e Faixa Etária".
- Visível para todos os perfis que já enxergam a tabela (Admin, Cadastro, Diretora, Visualização, Administradoras, Vendas, Executivo). Não substitui editar/excluir.
- Como hoje a coluna Ações só aparece quando `canEdit`, vamos:
  - Renderizar a coluna **Ações** sempre que houver pelo menos um botão visível (todos os perfis terão acesso ao botão "Valores").
  - Os botões editar/excluir continuam condicionados a `canEdit` / `canFullEdit`.

## Novo componente
`src/components/empresas/ValoresFaixaEtariaDialog.tsx`

Props:
```ts
{ empresa: Empresa | null; open: boolean; onOpenChange: (v: boolean) => void; }
```

Comportamento:
- Busca via React Query (chave `["empresa-valores", empresa.id]`) o último reajuste da empresa:
  - `reajustes_anuais` ordenado por `created_at desc`, `limit 1`, filtrando por `empresa_id`.
  - Se houver reajuste → busca `reajuste_faixas` (`reajuste_id = reajuste.id`).
- Exibe skeletons durante o carregamento.
- Estado vazio elegante: "Esta empresa ainda não possui reajuste registrado" + valores básicos do contrato (se disponíveis).

## Estrutura do modal
`Dialog` com `DialogContent` de largura grande (`sm:max-w-4xl`), `max-h-[90vh]`, `overflow-y-auto`, `rounded-xl`, animação `animate-fade-in`. Conteúdo organizado em `Tabs`:

1. **Resumo do Contrato**
   - Cards com: Empresa, Código do Contrato, Tipo Contrato, Modalidade (Enfermaria/Apartamento/Ambos detectado pelas flags do reajuste), Data de Vigência (`reajuste.data_vigencia` se existir), Mês do Reajuste (extraído da vigência ou `reajuste.mes_referencia`).

2. **Valores Enfermaria** (oculta se `possui_enfermaria === false`)
   - Card com Valor Atual, %, Valor Reajustado, Retroativo, Valor Final.
   - Valores em `formatCentavosBRL` (utilitário já existente em `src/lib/reajuste-utils.ts`).

3. **Valores Apartamento** (oculta se `possui_apartamento === false`)
   - Mesmo layout, totalmente separado da Enfermaria. **Não somar** os dois.

4. **Faixa Etária**
   - Tabela premium com colunas: Faixa | Enfermaria (Valor Final) | Apartamento (Valor Final).
   - Linhas geradas agrupando `reajuste_faixas` por `(idade_inicial, idade_final)` e pivotando por `modalidade`.
   - Colunas Enfermaria/Apartamento ocultas dinamicamente se a modalidade não existir.
   - Hover suave, cabeçalho destacado, bordas elegantes.
   - Se não houver faixas: estado vazio "Reajuste por valor único — sem faixa etária".

## Permissões e segurança
- Componente é **somente leitura**: nenhum botão de salvar, editar, excluir.
- RLS já permite SELECT em `reajustes_anuais` e `reajuste_faixas` para todos os perfis autenticados.
- Não altera nenhuma regra ou mutation existente.

## Detalhes técnicos
- Reaproveitar:
  - `formatCentavosBRL` de `src/lib/reajuste-utils.ts`.
  - Tipos do Supabase (`Database["public"]["Tables"]["reajustes_anuais"]`).
- Tabs via `@/components/ui/tabs` (shadcn já instalado).
- Tabela via `@/components/ui/table`.
- Skeleton via `@/components/ui/skeleton`.
- Animação: `animate-fade-in` e `animate-scale-in` nas trocas de aba.
- Tema: usar tokens semânticos (`bg-accent/30`, `text-primary`, `border-border`) — sem cores hard-coded.

## Arquivos alterados/criados
- **Criar**: `src/components/empresas/ValoresFaixaEtariaDialog.tsx`
- **Editar**: `src/pages/Empresas.tsx`
  - Importar `Wallet` e o novo dialog.
  - Estado `valoresEmpresa: Empresa | null`.
  - Renderizar coluna Ações para todos os perfis (botão Valores sempre presente).
  - Ajustar `colSpan` nas linhas de "Carregando…" / "Nenhuma empresa".

## Fora do escopo
- Não altera a aba Reajustes.
- Não cria endpoints/migrations.
- Não muda fluxo de cadastro/edição.
