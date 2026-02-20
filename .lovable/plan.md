

## Plano: App de Controle de Fechamento de Empresas

### Visão Geral
App para controlar movimentações mensais de empresas por período, com dashboard, exportação Excel e dados salvos na nuvem via Supabase. Sem autenticação — uso individual.

---

### Fase 1 — Estrutura e Cadastro de Empresas

**Tela de Cadastro de Empresas**
- Formulário com: Nome, CNPJ, Responsável pelo contrato, Operadora/Plano, Data de corte, Dia padrão de movimentação, Observações
- Listagem de empresas cadastradas com busca por nome
- Edição e exclusão de empresas
- Dados salvos no Supabase

---

### Fase 2 — Tela de Movimentações (Tela Principal)

- Registro de movimentação por empresa, mês de referência e período (01-05, 05-10, 10-15, 15-20, 20-25, 25-30)
- Campos: Data de envio para empresa, Data de retorno, Data de envio ao financeiro, Responsável pela movimentação, Observações
- **Status automático** calculado com base nas datas preenchidas:
  - ⏳ Aguardando envio | 📤 Enviado | 📥 Retornado | 💰 Enviado ao financeiro | ❌ Fora do prazo
- **Cores visuais**: Verde (concluído), Amarelo (aguardando), Azul (financeiro), Vermelho (fora do prazo)
- Filtros por mês, período, responsável e status
- Filtro rápido "Somente pendentes"
- Destaque em vermelho para empresas fora do prazo ou próximas do fim do período

---

### Fase 3 — Dashboard

- Resumo por período: total de empresas, dentro/fora do prazo
- Empresas pendentes de retorno e pendentes de envio ao financeiro
- Visão por responsável com suas pendências
- Filtros por mês, responsável e empresa

---

### Fase 4 — Exportação para Excel

- Exportação da listagem de movimentações com filtros aplicados
- Download em formato .xlsx

---

### Funcionalidades para fases futuras (não incluídas agora)
- Histórico completo de alterações por movimentação (Tela 4)
- Notificações/alertas mais avançados

---

### Navegação
- Menu lateral ou superior com: **Empresas** | **Movimentações** | **Dashboard**
- Design limpo e responsivo

### Backend (Supabase)
- Tabelas: empresas, movimentações
- Lógica de status e períodos calculada no frontend

