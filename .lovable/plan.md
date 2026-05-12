# Validação obrigatória antes de "Registrar Valores"

## Contexto

Em `src/pages/Reajustes.tsx` o botão **"Registrar Valores"** (linha 429) abre o `ReajusteDialog` (`src/components/reajustes/ReajusteDialog.tsx`). Dentro do diálogo, na aba **Informações Gerais**, o usuário preenche os campos básicos e usa **"Avançar →"** para ir até as abas **Enfermaria / Apartamento / Resumo**, onde de fato registra os valores.

Hoje a validação só ocorre no clique em **Salvar** (mutation), permitindo avançar abas e digitar valores mesmo sem informar Data, Percentual ou Modalidade. Vamos travar o fluxo logo na aba Geral.

## Escopo

Apenas frontend, no diálogo `ReajusteDialog.tsx`. A validação no `mutation.mutationFn` (linhas 192–198) já existe para Modalidade e cobre o backend lógico — vamos reforçá-la também para Data e Percentual, mantendo a barreira dupla.

## Regras de validação (aba Geral)

Campo válido quando:
- **Data de Aplicação** (`dataAplicacao`): string não vazia e parseável como data válida.
- **Percentual padrão (%)** (`percentual`): número > 0 (parser já existente `parsePctInput`).
- **Modalidades**: `possuiEnf || possuiApt` verdadeiro.

Derivar três flags + um booleano agregado `geralValido`.

## Comportamentos

1. **Aba Geral**
   - Cada campo obrigatório recebe:
     - borda `border-destructive` quando inválido após interação (estado `touched` por campo);
     - mensagem curta abaixo com ícone `AlertCircle` (lucide):
       - "Preencha a Data de Aplicação."
       - "Informe o Percentual padrão (maior que 0)."
       - "Selecione ao menos uma modalidade."
     - quando válido, mostrar ícone `CheckCircle2` verde discreto ao lado do label (feedback positivo).
   - Agrupar os 3 campos numa seção "Informações Básicas do Reajuste" com `border` sutil e título, sem alterar layout dos demais campos (Contrato, Ano, Observação permanecem onde estão).

2. **Botão "Avançar →"** (footer)
   - `disabled` enquanto `!geralValido` E `tab === "geral"`.
   - Wrappear num `Tooltip` (shadcn) com texto: *"Preencha as informações obrigatórias para continuar."* quando bloqueado.
   - Classes adicionais quando bloqueado: `opacity-60 cursor-not-allowed`.

3. **Tabs Enfermaria / Apartamento / Resumo**
   - `TabsTrigger` recebe `disabled={!geralValido}` (além das condições atuais de `possuiEnf/possuiApt`).
   - Impede pular a aba Geral via clique direto.

4. **Botão Salvar/Atualizar**
   - Também `disabled` quando `!geralValido`, evitando salvar registro inconsistente.

5. **Validação reativa em tempo real**
   - Como já usamos `useState` controlado, basta derivar `geralValido` por `useMemo` a partir de `dataAplicacao`, `percentual`, `possuiEnf`, `possuiApt`. Sem necessidade de `react-hook-form`/`zod` — manteríamos consistência com o restante do componente.
   - `touched` por campo: marca `true` no `onBlur` ou primeira mudança, evitando exibir erro vermelho ao abrir o diálogo.

6. **Reforço backend (defensivo)**
   - Ampliar o bloco de validação dentro de `mutation.mutationFn` para também rejeitar `!dataAplicacao` e `pctNum <= 0` antes de qualquer chamada Supabase. Mensagens equivalentes às visuais.

## Arquivos a alterar

- `src/components/reajustes/ReajusteDialog.tsx`
  - Adicionar `useMemo` para `dataAplicacaoValida`, `percentualValido`, `modalidadeValida`, `geralValido`.
  - Estado `touched` (`{ data: boolean; pct: boolean; mod: boolean }`); resetar no `useEffect` de abertura (linha 305).
  - Aplicar classes de erro/sucesso e mensagens nos inputs (linhas 387–407) e no `ModalidadesPicker`.
  - Envolver botão "Avançar →" em `Tooltip` (importar `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` de `@/components/ui/tooltip`); aplicar `disabled` combinado.
  - `disabled` adicional nos `TabsTrigger` enfermaria/apartamento/resumo.
  - `disabled` adicional no botão Salvar.
  - Reforço de validação no `mutationFn` (linhas 192–198).

Nenhuma alteração em `src/pages/Reajustes.tsx`, schema do banco ou outras telas.

## UX / animação

- Transição `transition-colors` nas bordas para suavizar mudança de estado.
- Ícone de check verde aparece com `animate-fade-in` (classe utilitária já usada no projeto).
- Mensagens de erro com `text-xs text-destructive flex items-center gap-1`.

## Não-objetivos

- Não introduzir `react-hook-form` nem `zod` apenas para este diálogo (manter padrão local com estados controlados).
- Não mexer em outras telas/diálogos de reajuste.
- Não alterar regras de status, permissões ou backend SQL.
