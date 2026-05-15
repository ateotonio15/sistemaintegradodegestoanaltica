# Reformulação da aba Arquivos — Repositório Documental Financeiro

## Objetivo
Transformar `/arquivos` em um módulo profissional de gestão documental **exclusivo do setor Financeiro/Admin**, mostrando **somente arquivos enviados manualmente** pelo Financeiro. Análises automáticas, anexos do Cadastro/operacional, espelhamentos via trigger e cache do sistema **não aparecem** mais aqui.

---

## 1. Banco de dados (migration)

### Nova tabela `financeiro_arquivos`
Campos de domínio:
- `empresa_id` (uuid, NOT NULL)
- `competencia` (text, formato `YYYY-MM`)
- `categoria` (text) — enum textual: Boletos, Notas Fiscais, Contratos, Excel Financeiro, PDF Financeiro, Comprovantes, Inclusões, Exclusões, Outros
- `nome_original` (text)
- `nome_armazenado` (text)
- `extensao` (text)
- `mime_type` (text)
- `tamanho_bytes` (bigint)
- `hash_arquivo` (text) — sha-256 hex
- `observacao` (text, nullable)
- `uploaded_by` (uuid)
- `uploaded_by_nome` (text)
- `storage_path` (text)
- `status` (text default `ativo`) — `ativo` | `substituido` | `removido`
- `versao` (int default 1)
- `versao_de` (uuid, nullable, FK lógica para id da versão anterior)

Padrão: `id`, `created_at`, `updated_at` + trigger `update_updated_at_column`.

Índices:
- `(empresa_id, competencia)`
- `(hash_arquivo)` — para detectar duplicidade
- `(uploaded_by)`, `(categoria)`

Constraint única para evitar duplicado ativo por empresa/competência:
- `unique (empresa_id, competencia, hash_arquivo) where status = 'ativo'`

### RLS
- Admin: ALL
- Financeiro: ALL
- Demais perfis: **sem acesso** (nenhuma policy SELECT) — mantém a aba escondida e bloqueada.

### Storage bucket
Novo bucket privado `arquivos-financeiro` (separado do `anexos-financeiro` que é usado pela trigger de espelhamento).

Policies em `storage.objects`:
- SELECT/INSERT/UPDATE/DELETE no bucket `arquivos-financeiro` somente para `admin` e `financeiro`.

> Layout do path: `{empresa_id}/{competencia}/{uuid}.{ext}`.

---

## 2. Roteamento (`App.tsx`)
Trocar `<ProtectedRoute>` da rota `/arquivos` por um novo `FinanceiroOnlyRoute` que libera **apenas** `isAdmin || isFinanceiro`. Demais perfis são redirecionados para `/`.

Esconder o link "Arquivos" do menu lateral (`AppLayout.tsx`/`NavLink.tsx`) para perfis não autorizados.

---

## 3. UI — `src/pages/Arquivos.tsx` (reescrita completa)

### Cabeçalho
- Título "Repositório Financeiro" + subtítulo.
- Botão **Enviar arquivos** (abre dialog de upload).

### KPIs (cards no topo)
- Total de arquivos (status ativo)
- PDFs
- Excels
- Últimos uploads (últimos 7 dias)
- Espaço utilizado (soma `tamanho_bytes`)

### Filtros
- Busca textual (nome, empresa, contrato, competência)
- Empresa (select)
- Competência (select dinâmico)
- Categoria (select)
- Tipo de arquivo (select: PDF, Excel, Imagem, Doc, Outros)
- Período de upload (date range)
- Usuário responsável (select)

### Tabela moderna (`Table` shadcn)
Colunas:
| Ícone | Nome do arquivo | Empresa | Contrato | Competência | Categoria | Tipo | Usuário | Data upload | Tamanho | Status | Ações |

Ações por linha:
- Visualizar (signed URL em nova aba; PDFs abrem em modal com `<iframe>`)
- Baixar
- Substituir (abre dialog; cria nova versão, marca anterior como `substituido`)
- Excluir (soft delete `status = 'removido'`)
- Histórico de versões (dialog listando versões anteriores)

Ordenação por data desc por padrão; agrupamento opcional por **competência** (toggle).

### Dialog de Upload (`UploadArquivoDialog.tsx`)
Campos:
1. Empresa (combobox)
2. Contrato (auto-preenchido a partir da empresa, read-only)
3. Competência (mes/ano)
4. Categoria (select obrigatório)
5. Observação (textarea opcional)
6. Drop zone com múltiplos arquivos + barra de progresso por arquivo

Validações client-side:
- Extensões: `.pdf, .xlsx, .xls, .csv, .docx, .png, .jpg, .jpeg`
- MIME type correspondente
- Tamanho máx 25 MB por arquivo
- Bloqueio de extensões executáveis (`.exe, .bat, .sh, .js, .msi, ...`)
- Cálculo sha-256 (Web Crypto). Antes do upload, consulta `financeiro_arquivos` por `(empresa_id, competencia, hash_arquivo, status='ativo')`. Se existir → toast aviso "duplicado, ignorado".

Após upload bem-sucedido:
- Insere registro em `financeiro_arquivos` com metadados completos.
- Invalida query e fecha dialog.

### Componentes novos
- `src/components/arquivos/UploadArquivoDialog.tsx`
- `src/components/arquivos/HistoricoVersoesDialog.tsx`
- `src/components/arquivos/PreviewPdfDialog.tsx`

---

## 4. Separação clara
- A aba **Arquivos** lê **apenas** `financeiro_arquivos` (bucket `arquivos-financeiro`).
- Não lê mais `anexos_financeiro`, `anexos_movimentacao`, nem `financeiro_analises`.
- A persistência de análises Excel × PDF continua intacta na aba Financeiro.

---

## 5. Critérios de aceite
1. Apenas Financeiro/Admin acessam a rota e veem o link no menu.
2. Somente arquivos enviados pelo dialog aparecem listados.
3. Upload múltiplo + drag and drop + barra de progresso funcionam.
4. Duplicidade (hash idêntico no mesmo escopo) é bloqueada.
5. Substituição cria nova versão preservando histórico.
6. Exclusão é soft delete; arquivo some da listagem padrão.
7. Filtros, busca e KPIs respondem corretamente.
8. Performance ok com paginação client-side até alguns milhares de registros (futuro: paginação server-side se necessário).

---

## Arquivos
- **Migration**: `supabase/migrations/<ts>_financeiro_arquivos.sql` (tabela + RLS + bucket + storage policies)
- **Novo**: `src/components/arquivos/UploadArquivoDialog.tsx`
- **Novo**: `src/components/arquivos/HistoricoVersoesDialog.tsx`
- **Novo**: `src/components/arquivos/PreviewPdfDialog.tsx`
- **Reescrito**: `src/pages/Arquivos.tsx`
- **Editado**: `src/App.tsx` (gate `FinanceiroOnlyRoute`)
- **Editado**: `src/components/AppLayout.tsx` (esconder link para não autorizados)
