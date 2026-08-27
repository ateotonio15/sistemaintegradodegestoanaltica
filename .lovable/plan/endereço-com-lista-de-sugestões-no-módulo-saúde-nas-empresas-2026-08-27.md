# Endereço com lista de sugestões no módulo Saúde nas Empresas

## Objetivo
No formulário de **Nova Palestra** (e Ações Preventivas), o campo **Endereço** deixa de ser um texto livre puro e passa a ser um combobox igual ao da aba **Uber Corporativo**: mostra todos os endereços já cadastrados, permite buscar e também digitar um endereço novo.

## O que muda

### 1. Componente compartilhado `EnderecoCombobox`
- Extrair o componente que hoje está embutido em `src/components/uber/CorridaDialog.tsx` para um arquivo reutilizável `src/components/EnderecoCombobox.tsx`.
- Comportamento mantido:
  - Lista "Endereços cadastrados" com rolagem e busca;
  - Opção `Usar "..."` para digitar um endereço novo;
  - Ícone de check no endereço selecionado.
- `CorridaDialog.tsx` passa a importar o componente compartilhado (sem mudança visual no Uber).

### 2. Fonte de endereços (mesma lógica do Uber)
- Hook utilitário `useEnderecosSugeridos` que monta a lista a partir de:
  1. **Endereço fixo da Samel** (primeiro da lista): "Samel - Av. Joaquim Nabuco, 1550 - Centro";
  2. **Endereços das empresas ativas** (campo `endereco` da tabela `empresas`);
  3. **Endereços já usados** em palestras e ações preventivas (`palestras_saude.endereco` e `acoes_preventivas.endereco`), para que endereços digitados manualmente antes também apareçam como sugestão;
- Lista deduplicada e ordenada alfabeticamente (pt-BR).

### 3. Aplicação nos formulários de Saúde
- `src/modules/saude-empresas/components/PalestraDialog.tsx`: campo "Endereço *" (placeholder "Local da palestra") vira o `EnderecoCombobox`.
- `src/modules/saude-empresas/components/EventoPreventivoDialog.tsx`: mesma substituição no campo de endereço.
- Mantido o preenchimento automático atual: ao selecionar a empresa, o endereço cadastrado dela continua sendo sugerido automaticamente quando o campo está vazio.
- Validação de obrigatoriedade e salvamento permanecem inalterados (valor continua sendo o texto do endereço).

## Detalhes técnicos
- Sem mudanças no banco de dados — o endereço continua sendo salvo como texto nas tabelas existentes.
- Queries via Supabase + React Query (staleTime 60s), mesmo padrão do Uber.
- Componente usa `Popover` + `Command` (cmdk) já disponíveis no projeto.

## Validação
- Abrir "Nova palestra": clicar no campo Endereço deve listar o endereço da Samel primeiro, seguido dos endereços das empresas e dos já usados.
- Busca filtra a lista; digitar um endereço novo oferece a opção "Usar ...".
- Selecionar empresa sem endereço digitado continua preenchendo automaticamente.
- Aba Uber Corporativo continua funcionando como antes.
