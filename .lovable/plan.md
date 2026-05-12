## Nova aba "Arquivos" — central unificada de anexos

A aba ainda não existe; será criada do zero já com o nome final **"Arquivos"** (sem passar por "Central de Anexos"). Reusa 100% das tabelas e buckets existentes — apenas agrega visualmente.

### Fontes de dados (já existentes)

- `anexos_movimentacao` (bucket `anexos-movimentacoes`) → ligado a `movimentacoes_mensais` → empresa + competência (mês/ano de referência).
- `anexos_financeiro` (bucket `anexos-financeiro`) → ligado a `financeiro_movimentacoes` → empresa + competência. Coluna `origem` (normal / cobrança / etc.) usada para classificar Nota Fiscal, Boleto, Recibo etc.

Nada muda no banco — apenas leitura.

### Roteamento e menu

- Nova rota `/arquivos` em `src/App.tsx`, protegida (Admin, Cadastro/Comum e Financeiro; Executivo e Visualização também leem). Enfermeira fica fora.
- Item de menu em `src/components/AppLayout.tsx`:
  ```
  { to: "/arquivos", label: "Arquivos", icon: FolderArchive }
  ```
  Posicionado após "Financeiro" e antes de "Reajuste".

### Página `src/pages/Arquivos.tsx`

Layout corporativo, em três níveis hierárquicos:

```
Empresa  ▸  Competência (MM/AAAA)  ▸  Categoria  ▸  Arquivos
                                    ├── Excel faturamento
                                    ├── Nota fiscal
                                    ├── Boleto
                                    ├── Recibos
                                    └── Outros
```

UI:
- Cabeçalho com título "Arquivos" + subtítulo "Central de anexos por empresa e competência".
- Barra de filtros (sticky):
  - Busca global (nome do arquivo, empresa, contrato, CNPJ).
  - Select de Empresa.
  - Select de Competência (mês/ano).
  - Select de Categoria (Excel, Nota Fiscal, Boleto, Recibo, Outros, Movimentação).
  - Toggle "Somente com anexos".
- Lista de **Empresas** em `Accordion` (shadcn). Cada item mostra contador total de arquivos.
- Dentro de cada empresa, sub-accordion por **Competência** (ordem decrescente). Mostra contador por categoria.
- Dentro da competência, grupos por **Categoria** com lista de arquivos: ícone por mime, nome, tamanho, data de upload, autor.
- Ações por arquivo: **Preview** (reusar `AnexosViewerDialog`), **Download** (signed URL no bucket correto), e badge da origem (Movimentação / Financeiro).
- Empty state amigável quando filtros não retornam nada.

### Classificação por categoria

Função utilitária local (sem migration):
- `anexos_financeiro.origem = 'cobranca'` ou `mime` PDF + nome contendo "boleto" → **Boleto**.
- `mime` PDF + nome contendo "nota"/"nfse"/"nfs" → **Nota Fiscal**.
- `mime` PDF + nome contendo "recibo" → **Recibo**.
- `mime` Excel (`xlsx`/`xls`/`csv`) → **Excel faturamento**.
- `anexos_movimentacao` → **Movimentação** (sempre).
- Restante → **Outros**.

### Data fetching

- Hook `useArquivos` com `useQuery`:
  - Carrega `empresas` (id, nome, codigo_contrato, cnpj).
  - Carrega `anexos_movimentacao` + join leve com `movimentacoes_mensais (mes, ano, empresa_id)`.
  - Carrega `anexos_financeiro` + join leve com `financeiro_movimentacoes (mes, ano, empresa_id)`.
  - Mescla em estrutura `Map<empresaId, Map<competencia, Anexo[]>>`.
- Invalidações reusam as queryKeys existentes para refletir uploads/exclusões feitas em outras telas.

### Permissões

- Admin / Cadastro / Financeiro: ver tudo, baixar tudo.
- Executivo / Visualização: leitura/preview/download apenas.
- Enfermeira: sem acesso à rota.
- Sem upload/exclusão direto na aba (mantém origem nas telas atuais para preservar regras de RLS e workflows).

### Não será alterado

- Nenhuma tabela, RLS, bucket ou trigger.
- Componentes `AnexosMovimentacao`, `AnexosViewerDialog`, telas de Movimentações/Financeiro/Dashboard continuam idênticos.
- Demais módulos do menu inalterados.
