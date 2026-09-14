# Corrigir avaliações múltiplas pelo mesmo QR Code

## Objetivo
Permitir que várias pessoas respondam a avaliação da mesma empresa usando o mesmo QR Code, sem a página ficar preta após a primeira resposta.

## Implementação
- Ajustar a busca pública do formulário para continuar retornando o formulário vinculado ao envio mesmo quando já existe uma resposta.
- Manter cada nova resposta como um registro separado, preservando as respostas anteriores.
- Exibir uma mensagem de erro visível caso os dados do formulário não possam ser carregados, evitando tela vazia.

## Validação
- Abrir o QR Code atual da Callidus depois da primeira resposta e confirmar que o formulário aparece.
- Enviar outra avaliação pelo mesmo link e confirmar que a nova resposta é salva separadamente.
- Verificar a página em tela de celular e o estado do projeto.

## Detalhes técnicos
- Alterar apenas a função pública que fornece o formulário pelo token e o tratamento visual de falha da página.
- Não trocar o token nem exigir a geração de um novo QR Code.
