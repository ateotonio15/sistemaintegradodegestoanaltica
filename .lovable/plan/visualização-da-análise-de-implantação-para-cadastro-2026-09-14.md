# Visualização da Análise de Implantação para Cadastro

## Objetivo
Criar uma apresentação compacta da mesma Análise de Implantação apenas para usuários dos perfis Cadastro e Cadastro / Implantação, sem alterar dados, regras, permissões ou ações.

## Alterações
- Identificar a visualização exclusiva pelos perfis internos correspondentes a Cadastro (`comum`) e Cadastro / Implantação (`administradoras`).
- Manter a janela atual exatamente como está para Diretoria, Jurídico, Financeiro e todos os demais perfis.
- Criar, dentro da janela existente, uma versão branca e limpa para o Cadastro, com:
  - identificação e situação principal do contrato no topo;
  - resumo compacto dos dados de implantação, dados comerciais, validações e pontos de atenção;
  - cartões de bordas suaves, sem transformar cada campo em um cartão separado;
  - documentos visíveis em uma área resumida, com ação para abrir cada arquivo;
  - botão “Visualizar Mais” para revelar todas as informações e o histórico já disponíveis;
  - ações atuais do Cadastro fixas no rodapé da janela.
- Preservar textos, estados de carregamento, bloqueios, confirmações, observações e mensagens existentes.
- Garantir boa leitura em telas menores, sem sobreposição e com o rodapé sempre acessível.

## Regras preservadas
- Nenhuma consulta, gravação, função do banco, permissão ou cálculo será alterado.
- Aprovação, solicitação de correção, rejeição, liberação, atribuição e visualização de documentos continuarão usando exatamente as ações atuais.
- Nenhum campo, documento, histórico, pendência ou divergência será removido; os detalhes apenas ficarão recolhidos inicialmente na versão do Cadastro.

## Detalhes técnicos
- A seleção da apresentação será feita no componente da Análise de Implantação usando o perfil autenticado.
- A lógica e os dados atuais serão compartilhados entre as duas apresentações para evitar comportamentos diferentes.
- A nova estrutura será isolada em componente visual próprio, deixando a apresentação atual intacta para os outros perfis.
- A validação final incluirá checagem de tipos, estado do build e teste da janela em desktop e tela menor.
