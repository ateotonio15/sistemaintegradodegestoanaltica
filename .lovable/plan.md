## Padronização do Botão de Alerta — Faturamentos Enviado

### Situação atual

- **Dashboard Financeiro**: o card `FaturamentosEnviadoFinanceiro` já possui o visual padrão de alerta (borda `warning`, ícone `BellRing` em pílula amarela, badge contador, e um botão `ghost` "Ir ao Financeiro").
- **Dashboard Usuário Comum**: o card `FaturamentosEnviadosCard` é apenas uma lista passiva (ícone `Send`), sem botão de ação. Para enviar faturamento ao financeiro, hoje o usuário precisa abrir a aba Movimentações e editar a data manualmente.

### Objetivo

Espelhar a mesma identidade visual de alerta no card do usuário comum **e adicionar um botão ativo dentro dele** que dispare o fluxo "Enviar faturamento ao financeiro" (ou seja, leve o usuário direto para a ação que cria o alerta "Faturamentos Enviado" para o Financeiro).

### O que muda

#### 1. `FaturamentosEnviadosCard.tsx` (usuário comum) — alinhar visual ao do Financeiro

- Header passa a usar a **mesma estrutura visual** do `FaturamentosEnviadoFinanceiro`:
  - Pílula arredondada `bg-warning/15` com ícone `BellRing` em `text-warning` (mesmo tamanho 8x8).
  - Título "Faturamentos Enviado" + badge contador no mesmo estilo (`variant="outline"`).
  - Borda do card `border-warning/30` para reforçar identidade de alerta.
- Adicionar **botão de ação** no canto superior direito do header (mesmo lugar do "Ir ao Financeiro" do Financeiro):
  - Texto: **"Enviar Faturamento"**
  - Estilo: `Button size="sm"` com ícone `Send` à esquerda e `ChevronRight` à direita (espelhando o padrão do Financeiro).
  - Ação: navegar para `/movimentacoes` (a aba onde o usuário preenche `data_envio_financeiro` e anexa os documentos obrigatórios — fluxo que dispara o alerta no Financeiro via o trigger já existente `handle_envio_financeiro`).
- Manter intactas: a lista de itens já enviados, contadores "Pendente/Finalizado", realtime e regras de RLS atuais.

#### 2. Texto e nomenclatura

- Padronizar o **título do card** para **"Faturamentos Enviado"** (singular, igual ao do Financeiro), seguindo a regra que o usuário definiu na etapa anterior.
- Badge "X total" e "X pendente(s)" continuam visíveis abaixo, sem mudança.

#### 3. Sem mudanças no fluxo de dados

- Nenhuma migração SQL necessária — toda a lógica do alerta `Faturamentos Enviado` (criação ao preencher `data_envio_financeiro`, finalização ao financeiro registrar `data_envio_nota`) já está implementada via triggers.
- Nenhuma mudança em RLS, em `AnexosMovimentacao`, ou no painel do Financeiro.

### Resultado para o usuário

```text
┌─────────────────────────────────────────────────────────────┐
│ 🔔  Faturamentos Enviado  [3]      [ Enviar Faturamento → ]│  ← novo botão padrão
├─────────────────────────────────────────────────────────────┤
│  Empresa A  · 11/2026 · enviado em 27/04         🟡 Pendente│
│  Empresa B  · 11/2026 · enviado em 25/04        🟢 Finalizado│
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

Mesmo visual no Dashboard do Financeiro (já existente) e no Dashboard do Usuário Comum, com o botão cumprindo a função correta em cada perfil:

- **Financeiro** → "Ir ao Financeiro" (já existia).
- **Usuário Comum** → "Enviar Faturamento" (novo, vai para Movimentações).

### Detalhes técnicos

- Arquivo único alterado: `src/components/dashboard/FaturamentosEnviadosCard.tsx`.
- Adicionar `useNavigate` de `react-router-dom` e ícones `BellRing`, `ChevronRight` de `lucide-react`.
- Reaproveitar tokens do design system (`warning`, `success`, `primary`) já usados no projeto.
- Sem alterações em rotas, banco de dados ou edge functions.
