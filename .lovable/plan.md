## Objetivo
Adicionar busca de Pessoa Física em tempo real no formulário de Demandas (`DemandaFormDialog.tsx`), integrando à API `https://atend-back-002.samel.com.br/buscarPessoaFisica?q=`, com autocomplete pelo nome e preenchimento automático via segunda chamada por CPF.

## Onde
- Novo arquivo: `src/lib/pessoa-fisica-lookup.ts` — cliente da API + tipos.
- Novo componente: `src/components/demandas/PessoaFisicaAutocomplete.tsx` — input com dropdown, debounce, abort, loading.
- Editar: `src/components/demandas/DemandaFormDialog.tsx` — trocar o `<Input>` do campo "Nome do cliente" pelo autocomplete; ao selecionar, chamar novamente por CPF e preencher `nome_cliente`, `cpf` e novo campo `data_nascimento` (armazenado no state local; não persistido no banco por enquanto).

## Comportamento
1. Usuário digita no campo "Nome do cliente".
2. Debounce de 300ms; só dispara a partir de 3 caracteres.
3. `AbortController` cancela a requisição anterior a cada digitação; `AbortError` é ignorado.
4. Fetch: `GET {ENDPOINT}?q=${encodeURIComponent(termo)}`.
5. Loader (spinner) exibido durante a busca.
6. Dropdown lista resultados mostrando:
   - Linha 1: `NM_PESSOA_FISICA`
   - Linha 2: `CPF: {NR_CPF}` (omitida se `NR_CPF` = "0" ou vazio) · `Carteirinha: {CARTEIRINHA}` · `DN: {DT_NASCIMENTO}`
7. Ao selecionar item:
   - Se `NR_CPF` válido (≠ "0" e não vazio), refaz `GET ?q={NR_CPF}` para obter dados atualizados; caso contrário, usa o próprio item.
   - Preenche no formulário: `nome_cliente = NM_PESSOA_FISICA`, `cpf = maskCpf(NR_CPF)`, e guarda `data_nascimento = DT_NASCIMENTO` em estado local (exibido como campo readonly ao lado, se disponível).
8. Fechar dropdown ao selecionar / clicar fora / Esc.

## Interação com lookup existente por CPF
O `useEffect` atual em `DemandaFormDialog` que dispara `fetchBeneficiarioByCpf` quando o CPF tem 11 dígitos permanece — continua útil quando o usuário digita CPF manualmente. Ao selecionar via autocomplete, os campos já ficam preenchidos e esse efeito apenas revalida (sem sobrescrever `nome_cliente` já preenchido, comportamento já existente).

## Notas técnicas
- Endpoint público, sem auth. Assumindo CORS liberado (mesma origem já usada por `getDadosBeneficiario`). Se falhar por CORS, avisar o usuário — não há proxy previsto.
- Nenhuma alteração de schema/DB.
- Nenhuma dependência nova.
