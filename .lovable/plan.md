## Remoção completa do PRÊMIO

### Frontend (`src/pages/Financeiro.tsx`)
- Remover import `exportarPremio` e ícone `Trophy` (se não usado em outro lugar).
- Remover estados `premioOpen`, `premioPeriodo`, `isExportingPremio`.
- Remover função `handleExportPremio`.
- Remover bloco do `<Popover>` com botão "PRÊMIO" e seleção de período.
- Remover todo o trecho do upsert em `a_receber` dentro do fluxo de análise (linhas ~795–847), incluindo a busca de empresa/CNPJ feita só para esse upsert.

### Arquivos a deletar
- `src/lib/premio-export.ts`

### Banco de dados (migration)
- `DROP TABLE public.a_receber CASCADE;` (remove tabela, índices, RLS e trigger associados).

### Verificação
- Rodar busca por `premio`, `a_receber`, `exportarPremio`, `AReceberRow`, `Trophy` para confirmar que nenhuma referência sobrou.
- Conferir build.
