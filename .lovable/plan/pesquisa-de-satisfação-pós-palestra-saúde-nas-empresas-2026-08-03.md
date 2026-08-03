# Pesquisa de Satisfação pós-palestra (Saúde nas Empresas)

## Decisão de base de dados

O backend (Lovable Cloud) já está ativo e o projeto já tem:
- `empresas` — cadastro de empresas clientes (não será criada uma tabela `companies` nova).
- `palestras_saude` — palestras por empresa, com data, tema, status e executiva (não será criada uma tabela `lectures` nova).
- Um padrão já funcionando de formulário público sem login por token (`/avaliar/:token` + funções seguras no banco), que será reaproveitado.

Portanto criamos apenas o que falta: perguntas, respostas e o link público da palestra.

## Novas tabelas

- `palestra_pesquisa_templates` — conjunto de perguntas padrão reutilizável (nome do template, ativo).
- `palestra_pesquisa_perguntas` — pergunta pertencente a um template OU a uma palestra específica: texto, tipo (`nota`, `multipla_escolha`, `texto_livre`), opções (para múltipla escolha), obrigatória, ordem.
- `palestra_pesquisas` — a pesquisa daquela palestra: vínculo com `palestras_saude`, token público único, aberta/fechada, criada em.
- `palestra_pesquisa_respostas` — um envio (submissão) por participante, com data/hora.
- `palestra_pesquisa_respostas_itens` — valor respondido por pergunta (nota, opção escolhida ou texto).

Regras de acesso:
- Usuários internos com perfil de saúde (admin, enfermeira, coordenadora, diretoria) administram templates, perguntas e pesquisas e leem os resultados.
- O público não lê nem escreve diretamente nas tabelas: duas funções seguras no banco atendem o link público —
  uma retorna empresa, tema e perguntas a partir do token; outra grava as respostas a partir do token, só se a pesquisa estiver aberta.

## Painel administrativo

Nova sub-aba "Pesquisa de Satisfação" em `/saude-empresas/pesquisas`, no mesmo menu das abas Palestras/Preventivas.

- Seleção de empresa e mês/ano → lista as palestras daquele recorte (com tema já cadastrado na palestra).
- Edição do tema de saúde do mês direto no card (grava em `palestras_saude.tema`).
- Editor de perguntas com adicionar, editar, remover e reordenar (setas para cima/baixo), suportando nota 1–5, múltipla escolha (com opções) e texto livre.
- Template padrão: botão "Usar perguntas padrão" copia o template para a palestra, e a cópia é editável sem afetar o template. Também é possível salvar as perguntas da palestra como novo padrão.
- Botão "Gerar QR Code e Link": cria a pesquisa com token, mostra o QR Code na tela, botão para baixar a imagem PNG e o link em texto com botão de copiar.
- Botão para abrir/fechar a pesquisa (impedir novas respostas).

## Página pública

Rota `/pesquisa/:token`, sem login, mobile-first:
- Topo com nome da empresa, tema do mês e data da palestra.
- Perguntas na ordem cadastrada: estrelas/escala 1–5, opções de múltipla escolha, campo de texto.
- Validação das perguntas obrigatórias e tela de agradecimento após o envio.
- Reenvio bloqueado na mesma sessão via `localStorage` por token.

## Dashboard de resultados

Na mesma sub-aba, uma aba "Resultados" com filtros por empresa e período (mês/ano):
- Média de satisfação por mês (gráfico de linha, Recharts, mesmo padrão dos demais gráficos do projeto).
- Comparativo de satisfação por empresa (barras).
- Total de respostas por palestra.
- Distribuição das perguntas de múltipla escolha (barras/pizza).
- Lista das respostas de texto livre, filtrável por empresa e mês.

## Detalhes técnicos

- Tabelas novas com RLS habilitada e GRANTs; leitura/escrita interna restrita aos perfis de saúde via as funções `is_saude_editor` / `is_saude_reader` já existentes.
- Acesso público exclusivamente pelas duas funções `SECURITY DEFINER` por token — sem GRANT para acesso anônimo direto às tabelas.
- QR Code: adicionar a dependência `qrcode` (geração em canvas/PNG para exibir e baixar); nenhuma biblioteca de QR existe hoje no projeto.
- Página pública fica fora do layout autenticado, seguindo o padrão de `ResponderPorToken`.
- Gráficos com Recharts e componentes shadcn já usados no módulo, mantendo cores e tipografia atuais.

## Ordem de implementação

1. Migração das tabelas, políticas e funções por token.
2. Painel admin (seleção, editor de perguntas, template padrão, QR Code/link).
3. Página pública de resposta.
4. Dashboard de resultados.
