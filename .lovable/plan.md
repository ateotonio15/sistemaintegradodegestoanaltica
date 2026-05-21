# Etapa 47 — Responsável Automático para Administradoras

## Objetivo
Quando `Tipo de Contrato = Administradora`, preencher automaticamente o campo "Responsável pelo Contrato" com **"Márcia Cristina"**, mantendo o fluxo Empresarial inalterado.

## Mudanças

### 1. `src/pages/Empresas.tsx` (form de cadastro/edição)
- No `onValueChange` do Select de `tipo_contrato`:
  - Se valor = `ADMINISTRADORA` → setar `responsavel_contrato = "Márcia Cristina"`.
  - Se mudar para `EMPRESARIAL` e o valor atual for "Márcia Cristina" (auto-preenchido) → limpar para `""`, devolvendo edição manual.
- Garantia no submit (`handleSave`): se `tipo_contrato === "ADMINISTRADORA"` e `responsavel_contrato` vazio, forçar "Márcia Cristina" antes do upsert (já existe bloco que ajusta payload para ADMINISTRADORA — adicionar essa linha).
- Input "Responsável pelo Contrato" recebe classe `transition-all duration-300` para suavizar a atualização do valor.

### 2. Sem mudanças de banco
Coluna `empresas.responsavel_contrato` já existe e aceita texto. Filtros, dashboards e movimentações que já usam esse campo passam a refletir "Márcia Cristina" automaticamente.

### 3. Validação
- Campo continua obrigatório (`*`). Como o auto-preenchimento garante valor, não há risco de salvar vazio para Administradora.

## Não fazer
- Não alterar fluxo Empresarial.
- Não sobrescrever `responsavel_contrato` de contratos Empresariais existentes.
- Não bloquear edição manual em outros tipos.
