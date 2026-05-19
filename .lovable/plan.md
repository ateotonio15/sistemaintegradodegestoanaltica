# ETAPA 43 — Leitura inteligente do layout de importação (regra do "I")

Refinar `src/lib/relatorio-vidas-validator.ts` para que a validação do layout Excel processe apenas linhas com `TIPO OPERACAO = "I"` e reaproveite dados já existentes no banco, reduzindo erros e retrabalho.

## 1. Mudanças no validador (`src/lib/relatorio-vidas-validator.ts`)

- Após ler o header, localizar a coluna `TIPO OPERACAO`.
- Para cada linha:
  - Ler o valor de `TIPO OPERACAO` com `trim()`.
  - Se vazio / null / undefined / espaços → **ignorar a linha inteira**: não conta em `total_linhas`, não conta em `vazias/preenchidas` das colunas, não gera pendência.
  - Se diferente de `"I"` (case-insensitive) → ignorar igualmente e contar em `linhas_ignoradas_outro_tipo` (apenas para feedback).
  - Se `= "I"` → validar normalmente (campos obrigatórios, CPF, CEP, datas, etc.).
- Novos contadores no retorno:
  - `linhas_lidas` (total de linhas com qualquer conteúdo)
  - `linhas_validas` (TIPO OPERACAO = "I")
  - `linhas_ignoradas_vazias`
  - `linhas_ignoradas_outro_tipo`
  - `linhas_reaproveitadas` (CPF já existente no banco)
- Aceitar um parâmetro opcional `cpfsExistentes: Set<string>` para marcar campos como **opcionais** quando o CPF da linha já existe (não gerar erro de campo vazio para essa linha, exceto o próprio `TIPO OPERACAO`, `CPF` e `GRAU PARENTESCO`).

## 2. Reaproveitamento de dados (consulta ao banco)

Antes de chamar `validarRelatorioVidas` no wizard:

- Extrair todos os CPFs (coluna `CPF`) das linhas com `TIPO OPERACAO = "I"`.
- Consultar `vidas_samel` / fonte equivalente para obter os CPFs já cadastrados.
- Passar o `Set<string>` para o validador.

Se a tabela de vidas não estiver disponível no projeto, usar `implantacoes_contratos` apenas para sinalizar empresa/CNPJ já cadastrados (reaproveitamento por empresa). Detalhe técnico abaixo.

## 3. UI no wizard (`src/components/implantacao/ImplantacaoWizard.tsx`)

- Após a validação, exibir resumo com os novos contadores:
  - Linhas lidas / válidas (I) / ignoradas vazias / ignoradas outro tipo / reaproveitadas / erros / alertas.
- Aviso fixo (`<Alert>`): "Linhas sem TIPO OPERACAO = I foram ignoradas automaticamente."
- Tabela de pendências continua mostrando só linhas com `TIPO OPERACAO = "I"`.

## 4. Performance

- Loop continua O(linhas), mas pula imediatamente quando `TIPO OPERACAO ≠ "I"`, sem ler as demais células.

## 5. Não fazer

- Não alterar o schema do banco.
- Não mudar o upload, storage ou demais etapas do wizard.
- Não remover validações existentes para linhas com `I`.

## Detalhes técnicos

- Função `normalize` já existente serve para comparar `"I"`.
- Atualizar interface `ValidacaoResultado` com os novos campos e ajustar consumidores (`ImplantacaoWizard.tsx` exibe `total_linhas` hoje; trocar pelos novos contadores).
- `cpfsExistentes`: `Set<string>` com apenas dígitos. Lookup com `cpf.replace(/\D/g,"")`.
- Para reaproveitamento real consultar `supabase.from("vidas_samel").select("cpf").in("cpf", lista)` em lote (máx 1000 por chamada). Caso a tabela não exista no schema atual, deixar o parâmetro opcional e seguir com `Set` vazio — a regra do "I" já entrega o ganho principal.

```text
Linha do Excel
   │
   ├─ TIPO OPERACAO vazio ──► ignorar (linhas_ignoradas_vazias++)
   ├─ TIPO OPERACAO ≠ "I" ──► ignorar (linhas_ignoradas_outro_tipo++)
   └─ TIPO OPERACAO = "I"
         │
         ├─ CPF existe no banco ──► validar mínimos, marcar reaproveitada
         └─ CPF novo            ──► validar todos os campos obrigatórios
```
