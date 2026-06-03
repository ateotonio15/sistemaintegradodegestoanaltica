# Calculadora de Cobrança Retroativa

Transformar o modal simples atual em uma calculadora profissional que substitui a planilha externa de cálculo proporcional, mantendo todas as funcionalidades existentes (PDF, vínculo com contrato/competência, histórico, análise completa).

## 1. Banco de dados (nova migration)

### Tabela `cobrancas_retroativas_itens` (beneficiários)
- `cobranca_retroativa_id` (FK → `cobrancas_retroativas`)
- `beneficiario_nome`, `codigo_beneficiario`, `matricula`
- `tipo_beneficiario` (titular/conjuge/filho/outro), `beneficiario_titular`
- `plano_modulo`, `mensalidade_centavos`
- `data_inicio`, `data_fim`
- `dias_proporcionais`, `valor_calculado_centavos`, `valor_final_centavos`
- `tipo_lancamento` (cobranca/devolucao)
- `observacao`
- `alterado_manualmente` (bool), `usuario_alteracao_id/nome`, `data_alteracao`

### Tabela `cobrancas_retroativas_periodos` (quebra por mês quando atravessa)
- `item_id` (FK)
- `mes_referencia` (YYYY-MM)
- `data_inicio_periodo`, `data_fim_periodo`
- `dias_mes`, `dias_cobrados`
- `mensalidade_centavos`, `valor_diario_centavos`, `valor_calculado_centavos`

### Alterações em `cobrancas_retroativas` (tabela existente)
Adicionar (sem quebrar campos atuais):
- `motivo` (text)
- `tipo_ajuste` (cobranca/devolucao)
- `valor_total_calculado_centavos`, `valor_total_manual_centavos`
- `status_calc` (rascunho/calculado/aplicado/cancelado) — separado do status atual de aplicação na nota

RLS: mesmo padrão da tabela pai (admin + financeiro full; outros via empresa).
GRANTs para `authenticated` e `service_role`.

## 2. Biblioteca de cálculo (`src/lib/cobranca-retroativa-calc.ts`)

Funções puras e testáveis:
- `diasDoMes(ano, mes)` — usa `new Date(ano, mes, 0).getDate()`
- `quebrarPeriodoPorMes(inicio, fim)` → array `{ mes, inicio, fim, diasMes, diasCobrados }`
- `calcularItem({ mensalidadeCentavos, inicio, fim, tipo })` →
  - para cada sub-período: `valorDiario = mensalidade / diasMes`, `valorParcial = valorDiario * diasCobrados`
  - soma e arredonda em centavos (Math.round em centavos para garantir 2 casas)
  - se devolução, sinal negativo
  - retorna `{ valorCalculadoCentavos, periodos[] }`
- `calcularTotais(itens)` → totais de cobranças, devoluções, líquido

## 3. Componente `CalculadoraRetroativaDialog.tsx` (novo)

Dialog `max-w-6xl` com scroll, integrado ao componente atual.

**Header**: Contrato, Empresa, Competência, Tipo do ajuste, Status (badge).

**Cards resumo** (topo): beneficiários, total cobranças, total devoluções, valor líquido.

**Bloco 1 — Dados gerais**: contrato/empresa (combobox existente), competência (select de meses), tipo_ajuste, motivo (select), descrição, upload PDF opcional (reusa storage atual).

**Bloco 2 — Período**: data inicial, data final (com aviso se atravessar mês).

**Bloco 3 — Beneficiários** (lista editável):
- Botões: Adicionar, Remover, Duplicar
- Campos: nome, código, matrícula, tipo, titular, plano/módulo, mensalidade, data início/fim, tipo lançamento
- Stub de "Importar Excel" (botão desabilitado com tooltip "em breve")

**Bloco 4 — Tabela de cálculo** (renderizada após "Calcular"):
- Colunas: beneficiário, código, matrícula, plano, mensalidade, datas, mês ref, dias mês, dias prop, valor diário, valor proporcional, tipo, valor final (editável), observação
- Linhas verde (cobrança) / vermelha (devolução) / amarela (alterada manualmente)
- Edição manual do valor final marca flag e captura usuário+data

**Footer**: Cancelar, Salvar rascunho, Calcular, Salvar cobrança.

## 4. Integração com `ReajusteCobrancaRetroativa.tsx`

- Manter o modal simples atual ("Editar Cobrança Retroativa") funcionando — apenas adicionar botão **"Abrir Calculadora"** que abre o novo dialog pré-preenchido com os dados da cobrança.
- Lista de cobranças retroativas: adicionar ícone/badge indicando que tem itens calculados.
- Ao salvar pela calculadora: grava `cobrancas_retroativas` (cabeçalho) + `cobrancas_retroativas_itens` + `cobrancas_retroativas_periodos` numa transação (RPC).

## 5. RPC `salvar_cobranca_retroativa_calc` (SECURITY DEFINER)

Recebe JSON do cabeçalho + itens + períodos, valida permissões (admin/financeiro/responsável), grava tudo atomicamente e retorna o id.

## 6. Integração com histórico/faturamento

`GerarHistoricoDialog.tsx` e `AnaliseCompletaDialog.tsx`: já leem `cobrancas_retroativas` pelo `valor_centavos` atual. **Atualizar para usar `valor_total_manual_centavos ?? valor_total_calculado_centavos ?? valor_centavos`** (fallback compatível). Sem mudança de schema legado.

## 7. Validações (zod no front + checks no RPC)
- Contrato/competência obrigatórios
- Data fim ≥ data início
- Mensalidade > 0
- Beneficiário com nome e plano
- Alerta visual quando atravessa mês e quando há valor manual

## 8. Não-objetivos desta entrega
- Importação real de Excel (apenas estrutura preparada)
- Geração de relatório PDF próprio (mantém PDF anexado opcional)
- Exportação Excel da calculadora (pode entrar em iteração futura)

## Arquivos

**Novos**
- `supabase/migrations/<ts>_calculadora_retroativa.sql`
- `src/lib/cobranca-retroativa-calc.ts`
- `src/components/financeiro/CalculadoraRetroativaDialog.tsx`

**Editados**
- `src/components/financeiro/ReajusteCobrancaRetroativa.tsx` — botão "Abrir Calculadora", indicador de itens
- `src/components/financeiro/GerarHistoricoDialog.tsx` — fallback de valor
- `src/components/financeiro/AnaliseCompletaDialog.tsx` — fallback de valor
