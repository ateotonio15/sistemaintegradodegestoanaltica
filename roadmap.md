# Roadmap — Primeiro pacote financeiro

## Arquivos próprios dos relatórios — pedido atual
- [ ] Permitir anexar PDF e Excel no controle de relatório, separados dos anexos de "Editar Movimentação".
- [ ] Usar esses arquivos no envio e conferir isolamento, permissões e fluxo de upload.

## Avisos globais de cirurgia — 26/10
- [x] Verificação única por minuto no servidor, deduplicação por reclamação/agendamento/data e leitura protegida por perfil e acesso à reclamação; nenhuma reclamação alterada.
- [x] Sino existente, indicadores dos cards e atalho com destaque da linha, preservando filtros salvos; fluxo autenticado com aviso simulado e ciência interceptada conferido sem gravações fictícias.
- [x] 23 testes aprovados, incluindo permissões reais das tabelas e regras de confirmação.
- [ ] Confirmar evento real: função e agendamento executados, mas a agenda não respondeu à nuvem; TI Samel precisa liberar acesso ou disponibilizar intermediário seguro. Nenhum aviso falso criado.

## E-mail da Samel — cadastro do remetente
- [x] Adicionar formulário em Configurações com domínio, nome, e-mail remetente e resposta; salvar somente dados não sigilosos, com edição protegida para Administrador.
- [x] Cinco testes aprovados; salvar/reabrir conferidos na sessão autenticada com gravação interceptada, sem endereços fictícios na operação; persistência real não exercitada. Envio permanece desligado.
- [ ] Ativação do envio: depende da configuração do domínio por administrador/proprietário do espaço de trabalho no Lovable; cadastro do remetente não configura o serviço.

## Demandas — alerta de cirurgia agendada
- [x] Integrar alerta e selo separados do status, verificar beneficiário e atualizar automaticamente pela agenda existente a cada minuto e ao retornar à janela.
- [x] Dezesseis testes aprovados; formulário, selo na lista, cancelamento após um minuto e troca de CPF conferidos com respostas simuladas em sessão autenticada, sem gravações.
- [ ] Confirmar alerta com resposta real da agenda: consulta da Ellen não respondeu em 20 segundos; depende da conectividade com a agenda Samel. Webhook não configurado no sistema externo; atualização disponível por consulta periódica.

## Relatórios de vidas em Movimentações
- [x] Integrar progresso no resumo e registro manual em lote somente para relatórios filtrados aptos.
- [x] Oito testes aprovados; lote de 25-30 e atualização do resumo conferidos na sessão atual com leitura simulada e gravação interceptada, sem alterar registros reais. Envio de e-mail permanece desligado; persistência real do lote não exercitada.
- [x] Integrar quatro colunas e formulário de registro manual, persistência protegida e status independente.
- [x] Cinco testes aprovados; salvar/reabrir conferido na sessão autenticada com gravação interceptada, sem dados fictícios na operação; persistência real não exercitada.
- [x] Remover as colunas "Destinatários" e "Data de Envio" da tabela, pois "Envio Empresa" e "Financeiro" já mostram essa informação; os campos continuam no formulário de registro e no fluxo em lote. Catorze títulos conferidos na tela; oito testes aprovados.

## Central — adesão explícita e contexto da nota 17790
- [x] Ler e comparar adesão separadamente; 42 testes do servidor e 67 regressões aprovados, incluindo centavos, ausência, quantidade não informada e dupla contagem.
- [x] Investigar outubro 15-20 versus novembro: não há regra comprovada de deslocamento; vencimento cadastrado na competência atual. Mês divergente descrito no PDF bloqueia aprovação, mantendo competência/período não conferidos.
- [x] Atualizar pacote do servidor e testar; anexação real confirmada desligada, sem envio nem alterações operacionais.
- [ ] Homologar nota 17790 com PDF original: depende do envio pela Central e da comprovação pelo Financeiro de que novembro pertence à movimentação de outubro 15-20; ainda não há recebimento dessa nota.

## Revisão dos quatro apontamentos de monitoramento
- [x] Restaurar limpeza de ID do rascunho, implantação, dias de fatura e desbloqueio do responsável; dois cadastros consecutivos com IDs distintos conferidos com gravações interceptadas, cancelar/reabrir limpa datas.
- [x] Permissões de reajustes: evidência antiga; consulta das políticas atuais confirma INSERT para admin/diretora e Cadastro/Administradoras vinculados; Visualização só lê. Nenhuma ampliação nem migração; origem dos logs de 01/10 não identifica usuário/empresa.
- [x] Troca de setor limpa tipo/reclamação; troca de tipo limpa reclamação; combinação incompatível bloqueada no envio. Fluxo conferido na sessão atual sem gravações.
- [x] Total PDF ignora apenas categoria explicitamente não aplicável, incluindo simplificada; valores desconhecidos/omitidos e ausência total continuam inconclusivos.
- [x] 59 testes aprovados e tela sem erros; gravação real de empresas e execução financeira real não realizadas para não alterar dados da operação.

## Agenda Cirúrgica — relatório pendentes
- [x] Pedido de 21/10: acesso direto como padrão nas duas abas; chave manual na sessão preservada, sem expor credencial privada via VITE.
- [ ] Acesso sem campo de chave: depende de intermediário autenticado da TI Samel ou liberação do acesso da nuvem; não embutir segredo no navegador.
- [x] Adicionar abas, relatório, filtros, indicadores, exportações e impressão.
- [x] Consultar relatório com a chave existente exclusivamente no ENV do servidor; não expor via VITE. Modo direto manual anterior preservado apenas nos agendamentos; não usado no novo relatório.
- [x] Sete testes aprovados; sessão real da solicitante, abas, filtro de risco, busca e CSV conferidos com resposta simulada sem gravações.
- [ ] Validar resultados reais, impressão e exportação com dados da Samel: consulta autenticada não respondeu após 30s; bloqueado pela conectividade da nuvem com a rede interna, depende da TI Samel.

## Endereços em Editar Informações
- [x] Ampliar confirmação da consulta CNPJ com identificação, endereço e contato; aplicar somente após confirmação, preservando ausentes, secundários e permissões. Dezessete testes aprovados; consulta real autenticada conferida e Cancelar/Usar estes dados testados com resposta fictícia, sem gravações na operação. Nome Fantasia não existe no formulário atual e fica somente na consulta; Executivo preserva a restrição do nome. Campos de endereço e contato continuam editáveis; salvar permanece separado.
- [x] Adicionar campos "Razão Social" e "Nome Fantasia" abaixo do "Nome" no formulário de empresas (colunas novas na tabela), preenchidos pela consulta de CNPJ; API sem nome fantasia nunca inventa valor, exibe "Nome fantasia não informado" na consulta e como dica no campo, que continua editável. Onze testes aprovados; formulário e aplicação conferidos com resposta fictícia no navegador, sem gravações na operação.
- [x] Acrescentar consulta pública CNPJ.ws junto ao CNPJ no formulário existente e no formulário restrito (CNPJ somente leitura), sem modificar permissões, campos ou endereços. Consulta real autenticada retornou dados; invalidade, carregamento, sucesso, não encontrado e indisponibilidade conferidos com respostas simuladas. Nenhuma gravação; consulta só exibe os dados, mantendo preenchimento manual. Doze testes aprovados (consulta e endereços). Limite da API pública: três consultas por minuto por IP; indisponibilidade mantém cadastro manual.
- [x] Finalizar endereços: permissões atuais verificadas (Executivo já autorizado para endereços; Visualização somente leitura), principal protegido no formulário e no servidor, confirmação Cancelar/Excluir e consulta compacta fora do formulário. Oito testes aprovados; salvar e consultar conferidos com escrita simulada, sem dados fictícios na operação. Não há histórico geral de alterações de campos da empresa para reutilizar; históricos de implantação e prioridade mantidos. Teste com contas específicas de Executivo/Visualização não executado.
- [x] Compactar a visualização com resumos, editor individual e lista recolhível. Conferidos adicionar, editar, cancelar, recolher/expandir e excluir com confirmação, sem salvar dados fictícios; quatro testes aprovados.
- [x] Preservar endereço principal e incluir secundários estruturados no formulário existente.
- [x] Quatro testes aprovados; formulário conferido com sessão real e salvar/reabrir simulados, preservando endereço antigo e dois secundários. Nenhum endereço fictício gravado na operação; persistência real não testada para evitar alterações nos cadastros.

## Reajustes por faixa etária
- [x] Exibir a primeira faixa nos valores de reajuste e disponibilizar todas as faixas no histórico.
- [x] Cinco testes aprovados e histórico real do contrato 2444 conferido: primeira faixa Enfermaria R$ 219,24, Apartamento R$ 306,94 e todas as faixas abertas, sem alterar registros.

## Plantão LSL — 20/10/2026
- [x] Reunir os históricos duplicados da LSL no cartão de outubro, sem apagar registros ou alterar permissões.
- [x] Conferir o plantão de 20/10 na tela com a sessão disponível: 32 plantões e 397 atendimentos preservados.
- [ ] Testar com a conta de Ana: bloqueado por falta de permissão para abrir uma sessão dessa usuária; requer login dela no preview.

## Registro de Reclamações — pedido atual
- [x] Persistir filtros durante navegação e operações.
- [x] Duplicar com data atual e resoluções reiniciadas; preservar CPF na edição.
- [x] Sugerir classificação via IA com histórico autorizado e confirmação humana.
- [x] Executar regressões e conferir os fluxos na tela sem dados de teste na operação. IA real conferida com empresa fictícia sem histórico; gravações de cadastro/edição interceptadas, CPF preservado e confirmação anterior ao envio comprovada.

- [x] Item 1 — Relatório analítico: completude, selo "legado", consolidado separando validado × com limitação
- [x] Item 2 — PDF: ausência/falha de leitura estruturada (totais anuláveis, falhaLeitura)
- [x] Item 3 — Testes de integração de documentos compartilhados (Previsão + relatório)
- [x] Revisão independente — 6 problemas corrigidos com testes de regressão:
  - [x] Relatório: dedup por hash + identidade do pagador (fatias 600+400 somam 1000)
  - [x] Previsão: consolidação por documento; "não separável" não contamina o conjunto (1000+600+400=2000)
  - [x] Previsão: identidade por nome sem CNPJ; ambiguidade sinalizada, nunca mesclada
  - [x] Relatório: consolidado no mesmo universo filtrado; reatribuição do valor de grupo
  - [x] Completude: exige meta.versao no JSON; registro antigo com categoria numérica = legado
  - [x] PDF: sumPdfTotal preserva ausência/falha (null), nunca zero confirmado
- [x] Item 4 — Conferência visual com mocks concluída em rodada anterior, incluindo cenários 5 e 6; sem gravações na operação. Integração com backend real não verificada.
- [x] Item 5 — Capturas e diff dos cenários 5 e 6 entregues na rodada anterior.

## Consulta CNPJ — identificação da situação (20/10/2026)
- [x] Rótulo "Situação Cadastral do CNPJ" com selo colorido (CNPJ ATIVA verde, SUSPENSA âmbar, BAIXADA/INAPTA/NULA vermelho) e "Situação desde" em DD/MM/AAAA.
- [x] Aviso "Não altera o status da empresa no sistema."; situação do CNPJ nunca preenche o status interno (camposFormularioCnpj não mapeia situação).
- [x] Função consultar-cnpj passa a retornar data_situacao_cadastral; 14 testes; conferência visual com resposta fictícia, sem gravações.

## Selo de situação do CNPJ na lista de empresas (20/10/2026)
- Botão de consulta (lupa) ao lado de cada CNPJ na lista de Empresas; ao clicar, mostra o selo colorido (ex.: "CNPJ ATIVA") inline.
- Consulta sob demanda (limite da API pública) com cache em memória por CNPJ na sessão; display-only, nunca grava.
- Componente `SituacaoCnpjLista` em `src/components/empresas/ConsultarCnpj.tsx`; célula CNPJ em `Empresas.tsx`.
- Verificado: tsgo limpo, 16 testes, Playwright com consulta real (selo "CNPJ ATIVA" na lista).

## Verificação automática da situação do CNPJ (20/10/2026)
- Sincronização automática via cron a cada minuto (função `sincronizar-situacao-cnpj`, lotes de 3, limite da API pública); resultados em `empresa_cnpj_situacao`, reconferência a cada 24h; falhas transitórias não gravam e são tentadas no ciclo seguinte.
- Lista de Empresas mostra o selo automaticamente ao lado do CNPJ já consultado; lupa manual continua para os pendentes.
- Filtro "Divergências CNPJ": situação diferente de ativa, erro de consulta ou endereço divergente do principal cadastrado (`divergenciaCnpj` em `src/lib/consulta-cnpj.ts`).
- Verificado: 23 testes, tsgo limpo, Playwright (selos automáticos + filtro), sincronização gravando "Ativa" no banco.

## Recebidos da Central NFS-e (23/10/2026)
- [x] Receptor, validação estrita, anexação transacional, proteção de grupos, tela "Recebidos da Central", 13 testes.
- [x] Validação independente do navegador no servidor, fila automática, 9 testes do servidor + vínculo testado em transação desfeita.
- [x] (Mayara) Arquivo do relatório de pendentes: já atendido; chave mantida no servidor.
- [ ] Homologação com a Central e liberação da anexação automática (aguarda o usuário).

## Conexão com Git (23/10/2026)
- [ ] Conectar o projeto ao Git pelo usuário em Configurações do projeto → Git. O Lovable sempre cria um repositório privado novo e não vincula um existente. Bloqueado: exige permissão de proprietário/admin do espaço de trabalho; a tela mostrou "No connections available".
- [ ] Depois de conectado: levar o histórico do repositório atual (github.com/ateotonio15/sistemaintegradodegestoanaltica) para dentro do repositório novo por merge, preservando o trabalho da Central de NFS-e e as alterações da agenda.
- [x] Conferir antes de conectar: `.env` do projeto contém apenas dados públicos do backend; chave da Samel não está no arquivo nem no código do navegador.

## Revisão Central → SIGA (23/10) e teste Lopes
- [x] Valor fiscal bruto obrigatório e conciliado com descritivo e faturamento.
- [x] Retroativos na seleção de validação; cache por chave forte; sugestão não resolve ambiguidade.
- [x] Homologação separada da produção na deduplicação; reenvio devolve canônico.
- [x] Fila com próxima tentativa e reserva; consultas filtradas/paginadas; barreira final completa no banco.
- [x] Verificação automática do pacote do validador. 24 testes do servidor + 15 de regras aprovados.
- [ ] Correções do lado da Central (resposta HTTP, envio pelo servidor a partir do XML): fora deste projeto.
- [x] Identidade fiscal lida do PDF (chave, número, prestador, tomador, emissão) e regra de nova versão de PDF; 36 testes do servidor.
- [ ] Validar a leitura da identidade num PDF real da Central: depende de uma entrega real em homologação.
- [ ] Homologação com a Distribuidora Lopes: movimentação 2026-10 é a única em “Faturado”, mas tem taxa de adesão (R$ 1.024,39), que o SIGA não lê na nota → seria inconclusiva; depende de decisão sobre essa categoria.
