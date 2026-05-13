# Etapa 35 — Validação Avançada da Implantação

Reforça a aba "Implantação de Contratos" com regras rígidas de anexos, Ticket automático e validação de layout do Relatório de Vidas.

## 1. Anexos (Etapa 1)

- Tornar **todos os tipos** obrigatórios para avançar: `anexo_1`, `contrato`, `relatorio_vidas`, `complementar` (mín. 1 arquivo cada). Mantém `anexo_1` com destaque "Prioritário".
- Sem limite de arquivos por categoria (já é o comportamento atual — manter).
- Reorganizar a UI em seções colapsáveis por categoria com contadores e ícone de status (✓ verde quando ≥1 / ✕ vermelho quando 0):
  - Anexo 1 (prioritário)
  - Contrato
  - Relatório de Vidas
  - Complementares
- Regras de dependência: ao subir "Contrato" mostrar aviso amarelo se faltar `relatorio_vidas` ou `complementar`. Validação `valid[1]` exige todos os 4 tipos com pelo menos 1 anexo.

## 2. Ticket automático (Etapas 2 e 3)

- Após extração do Anexo 1 (e sempre que `valor_enfermaria_centavos` mudar), preencher `ticket` automaticamente com o valor formatado em R$ de `valor_enfermaria_centavos`.
- Campo `Ticket` na Etapa 3 fica **readOnly** para todos os perfis exceto `admin` (Admin pode sobrescrever).
- Mostrar badge "Auto" ao lado do label e tooltip "Sincronizado com Valor Enfermaria".

## 3. Etapa 5 — Relatório de Vidas com parsing real

Substituir o input manual por leitura do arquivo `relatorio_vidas` mais recente:

- Botão **"Verificar Layout"** (loading elegante) que:
  1. Baixa o último arquivo `relatorio_vidas` do storage.
  2. Faz parse via `xlsx` (já em deps via excel-utils existentes) ou `papaparse` para CSV.
  3. Normaliza cabeçalhos (uppercase, sem acentos, trim).
  4. Verifica colunas obrigatórias (lista abaixo).
  5. Para cada linha, valida campos chave (CPF, CEP, datas, NOME, TITULAR, DATA NASC, GRAU PARENTESCO).
  6. Conta vidas: total, titulares (`GRAU PARENTESCO = TITULAR` ou vazio + `TIPO OPERACAO = INCLUSAO`) e dependentes.

**Colunas obrigatórias validadas:**
TIPO OPERACAO, NOME, TITULAR, DATA NASC, ESTADO CIVIL, NACIONALIDADE, SEXO, NOME DA MAE, CPF, UF EMISSOR, ORGAO EMISSOR, PAIS EMISSOR, CEP, ENDERECO, NUMERO, BAIRRO, CIDADE, ESTADO, DATA ADMISSAO, GRAU PARENTESCO, NR CARTAO SUS, TIPO LOGRADOURO, DT CASAMENTO.

**Validações por célula:**
- CPF: 11 dígitos + DV.
- CEP: 8 dígitos.
- DATA NASC / DATA ADMISSAO / DT CASAMENTO: data válida.
- Campos texto obrigatórios: não vazios (exceto DT CASAMENTO se ESTADO CIVIL ≠ "CASADO").

**Resultado visual** (modal/painel):
- Resumo: Total vidas, Titulares, Dependentes, Erros, Alertas.
- Checklist por coluna com ícone ✓ (ok) / ⚠ (alerta) / ✕ (erro).
- Tabela de pendências por linha: `Linha 42 — CPF vazio`, `Linha 15 — DATA NASC inválida`.
- Progress bar durante o parse.

## 4. Bloqueio de avanço

- `valid[5]` só fica `true` se a última verificação rodou com sucesso e **0 erros** de coluna ausente / campo obrigatório vazio. Alertas (não-críticos) permitem avançar.
- Se layout inválido: avançar bloqueado + mensagem clara.

## 5. Persistência

Adicionar colunas em `implantacoes_contratos`:
- `ticket_auto_sync boolean default true`
- `vidas_titulares integer`
- `vidas_dependentes integer`
- `relatorio_validacao jsonb` — `{ verificado_em, total_linhas, total_vidas, titulares, dependentes, erros: [...], alertas: [...], colunas_ausentes: [...] }`

`total_vidas` continua existindo e é sobrescrito pelo resultado da validação.

## 6. Performance

- Parse executado em chunks (XLSX.read com `dense:true`); processar em `requestIdleCallback` por blocos de 500 linhas para não travar a UI.
- Limite prático: 50k linhas — acima disso, mostrar aviso.

## Detalhes técnicos

- **Arquivos a editar**: `src/components/implantacao/ImplantacaoWizard.tsx` (Steps 1, 2, 3, 5, validações).
- **Novo arquivo**: `src/lib/relatorio-vidas-validator.ts` (parser + validator + cpf/cep/date helpers reutilizando `src/lib/excel-analysis-utils.ts` para leitura).
- **Migração SQL**: nova migration adicionando as 4 colunas em `implantacoes_contratos`.
- **Auth check para Ticket**: usar `useAuth()` + `has_role` já consumido no projeto (verificar como está em outras telas — `useUserRole`).
- **UI de validação**: componente inline na Etapa 5 com `Progress`, `Badge`, `ScrollArea` e tabela shadcn.

## Não-fazer

- Não alterar a lógica de extração do Anexo 1 (Etapa 2).
- Não permitir avanço com layout inválido.
- Não aceitar Ticket diferente de Valor Enfermaria (exceto override admin).
- Não limitar quantidade de anexos.
