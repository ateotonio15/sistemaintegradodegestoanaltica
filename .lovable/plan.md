# Dashboard Diretoria — Pesquisa de Satisfação

## Objetivo
Criar uma visão executiva separada para consolidar as pesquisas de **Palestras** e **Ações de Saúde**, preservando os QR Codes, formulários e resultados atuais.

## Entrega
- Adicionar o acesso **Dashboard Diretoria** na área Saúde nas Empresas, visível somente para Administrador, Diretoria e Diretoria de Saúde.
- Criar filtros por período, tipo de pesquisa e empresa.
- Exibir indicadores de respostas, empresas participantes, nota média, satisfação alta e comentários recebidos, com comparativo entre Palestras e Ações.
- Mostrar evolução mensal, comparação entre os dois tipos, ranking de empresas e médias por pergunta.
- Criar uma seção de pontos de atenção para notas baixas, empresas abaixo da média e comentários associados a avaliações críticas.
- Incluir uma tabela detalhada com pesquisa, empresa, data, média e comentário, além de exportação para Excel.
- Reaproveitar os dados e cálculos já usados em **Resultados consolidados**, ignorando respostas marcadas como teste.

## Organização visual
- Cabeçalho executivo com filtros e exportação.
- Linha de indicadores resumidos.
- Bloco de pontos de atenção.
- Gráficos comparativos e rankings.
- Tabela detalhada no final para consulta e auditoria.
- Visual alinhado ao padrão verde e aos modos claro/escuro do sistema.

## Detalhes técnicos
- Ampliar a consulta consolidada atual para fornecer uma linha por resposta, mantendo os itens por pergunta disponíveis para os gráficos.
- Centralizar os cálculos do painel em um novo hook/utilitário para evitar duplicação e preservar a tela atual.
- Adicionar uma rota protegida própria e um cartão de acesso na área Saúde nas Empresas.
- Não criar, editar ou excluir respostas no banco; o painel será somente leitura.
- Validar permissões, filtros, totais, exportação e apresentação em desktop e celular.
