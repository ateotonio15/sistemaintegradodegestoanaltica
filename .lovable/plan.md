# Plano — Botão de Alerta de Vencimento por Empresa

## Estado atual (já implementado)

O botão individual **"Alertar vencimento"** já existe no card **Dashboard Cadastro > Faturamentos Enviado**, com todas as regras pedidas:

- Aparece em cada linha de empresa (um botão por item)
- Ação manual: o Cadastro precisa clicar
- Após envio, o botão troca para badge **"Alerta enviado"** (estado mudou)
- Trigger no banco resolve o alerta e remove a marcação quando o Financeiro preenche `data_vencimento`

## Por que você não está vendo

O botão **só aparece em linhas com status "Enviado" ou "Finalizado"** (badge azul/verde). Linhas amarelas **"Pendente"** não exibem o botão — porque ainda não foram enviadas ao Financeiro, então não faz sentido alertar vencimento. Confirmamos no banco que existem linhas elegíveis (CENTRAO TELECOM, ETERNIT, IMPERIO, IPEM), mas elas podem não estar vinculadas ao seu usuário, ou estarem misturadas com muitas linhas Pendentes acima delas.

## Ajustes propostos para resolver visibilidade

### 1. Destaque visual do botão
Trocar o estilo do botão de outline discreto para um botão sólido amarelo, com ícone maior e texto em negrito. Fica impossível de não notar ao lado do badge "Enviado".

### 2. Contador no cabeçalho
Adicionar no título do card um badge: **"X aguardando vencimento"** quando houver linhas elegíveis. Assim o usuário sabe imediatamente que há ações disponíveis e quantas.

### 3. Reordenação inteligente
Mudar a ordenação para colocar **primeiro** as linhas que precisam de ação (Enviado sem vencimento), depois Pendentes, depois Finalizadas. Hoje Pendentes aparecem primeiro e empurram os botões para baixo do scroll.

### 4. Filtro rápido (opcional)
Adicionar um toggle "Apenas com ação pendente" no topo do card que oculta linhas Pendentes e Finalizadas com vencimento, mostrando só o que precisa de clique.

## Detalhes técnicos

- Arquivo único alterado: `src/components/dashboard/FaturamentosEnviadosCard.tsx`
- Sem mudanças no banco — trigger `handle_finalizar_alerta_vencimento` e tabela `alertas_financeiro` já cobrem o backend
- Sem mudanças nas RLS policies — perfis Cadastro e Financeiro já têm permissão correta
- Reordenação da lista: `Enviado sem venc. > Finalizado sem venc. > Pendente > Enviado com venc. > Finalizado com venc.`
- Estilo do botão: `bg-warning text-warning-foreground hover:bg-warning/90` em vez do outline atual

## Resultado esperado

Ao abrir o Dashboard, o usuário Cadastro verá no topo do card o contador "X aguardando vencimento", as empresas elegíveis aparecerão primeiro, e cada uma terá um botão amarelo sólido **Alertar vencimento** ao lado do nome. Após clicar, o botão vira **"Alerta enviado"** (cinza com ícone de relógio) e o Financeiro recebe o alerta no painel dele.
