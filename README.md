# SIGA

Prompt para criação de App – Controle de Fechamento de Empresas

🎯 Objetivo do App

Criar um aplicativo para controle de fechamento de movimentações por empresa, organizado por períodos mensais, permitindo acompanhar:

Datas de envio para a empresa

Data de retorno da empresa

Data de envio para o financeiro

Identificação de empresas fora do prazo

Responsável pelo contrato

Histórico de movimentações e registros

🗂️ Estrutura de Períodos

O sistema deve dividir automaticamente o mês nos seguintes períodos:

01 a 05

05 a 10

10 a 15

15 a 20

20 a 25

25 a 30

O app deve:

Identificar em qual período a empresa está

Mostrar o status do período (Dentro do prazo / Fora do prazo)

🏢 Cadastro de Empresas (Tela 1)

Campos:

Nome da empresa

CNPJ

Responsável pelo contrato

Operadora / Plano

Data de corte

Dia padrão de movimentação

Observações

🔄 Tela de Movimentações (Tela 2 – Principal)

Cada registro deve conter:

Empresa (lista suspensa)

Mês de referência

Período (automático conforme data)

Data de envio para empresa

Data de retorno da empresa

Data de envio para o financeiro

Status automático:

⏳ Aguardando envio

📤 Enviado para empresa

📥 Retornado pela empresa

💰 Enviado ao financeiro

❌ Fora do prazo

Responsável pela movimentação

Observações

⚠️ Regras de Status Automático

O sistema deve:

✔ Dentro do prazo

Quando o retorno da empresa estiver dentro do período correspondente.

❌ Fora do prazo

Quando:

Não houver retorno até o final do período
OU

O envio ao financeiro ocorrer após a data limite

Empresas fora do prazo devem aparecer em vermelho em um painel.

📊 Painel de Controle (Dashboard – Tela 3)

Mostrar:

Quantidade de empresas por período

Quantidade dentro do prazo

Quantidade fora do prazo

Empresas pendentes de retorno

Empresas pendentes de envio ao financeiro

Filtros:

Por mês

Por responsável

Por empresa

📜 Histórico de Movimentações (Tela 4)

Cada alteração deve gerar um histórico contendo:

Empresa

Mês

Período

Ação realizada (envio, retorno, envio financeiro)

Data e hora

Usuário que fez a alteração

🔔 Alertas Automáticos

O app deve:

Destacar empresas que estão próximas do fim do período sem retorno

Destacar empresas fora do prazo

Permitir filtro “Somente pendentes”

👤 Controle de Responsáveis

Cada empresa deve ter:

Um responsável pelo contrato

Um responsável pela movimentação do mês

O painel deve permitir visualizar pendências por responsável.

🎨 Regras Visuais

Cores sugeridas:

Verde → Concluído dentro do prazo

Amarelo → Aguardando retorno

Azul → Enviado ao financeiro

Vermelho → Fora do prazo

🔎 Funcionalidades Extras

Busca por empresa

Filtro por período

Exportação para Excel

Campo de observação por movimentação

🧠 Lógica Automática Importante

O sistema deve:

Identificar automaticamente o período com base na data de envio

Calcular se está dentro ou fora do prazo

Atualizar o status conforme as datas forem preenchidas

📝 Resultado Esperado

Um app que permita:

Controlar todas as empresas por período

Saber quem está pendente

Identificar atrasos

Acompanhar envio ao financeiro

Manter histórico completo das ações

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sistemaintegradodegestoanaltica.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c8c4a1b8-02b1-4db6-a011-44358b0a85dd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
