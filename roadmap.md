# Roadmap — Primeiro pacote financeiro

## Repositório de Envios — 30/10
- [x] Nova aba em "Utilitários" (/repositorio-envios) com Empresas → Arquivos → Prévia, agrupando por competência e período; Repositório Financeiro, Movimentações e envio de e-mails permanecem como estão. 9 testes aprovados; sessão autenticada conferiu o card no menu, as três colunas e a busca de empresas.
- [x] PDF e Excel de cada e-mail são guardados automaticamente após o servidor de e-mail aceitar o envio e registrados com empresa, contrato, competência, período, categoria, responsável e data/hora. Nenhum e-mail disparado na verificação: a gravação real depende do próximo envio.
- [x] Integração com o envio existente concluída e função publicada: mesmo fluxo de e-mail (sem rotina nova), registro só após SMTP aceito, falha de envio não registra, visualizar não duplica. Registro completo com origem "Envio automático por e-mail", versão (reenvios do mesmo arquivo sobem v2, v3...) e status "Enviado", exibidos na prévia. 9 testes aprovados, build OK e tela autenticada conferida sem erros.
- [x] Controle de versão e substituição automática: mesmo documento (empresa + contrato + competência + período + categoria, independente do nome do arquivo) faz o envio novo substituir o anterior — o antigo fica "Substituído" e nunca é apagado, o novo fica "Atual". Listagem mostra só a versão atual; prévia tem "Histórico de versões" com data, responsável e status de cada uma. Regra provada no banco em transação desfeita (v1 Substituído, v2 Atual com nomes diferentes), 13 testes aprovados, build OK e tela conferida no viewport real com versões simuladas.
- [x] Interface final: indicadores no topo (Empresas com arquivos, Arquivos atuais, Arquivos substituídos, Envios realizados), filtros por Competência/Período/Categoria/Responsável/Tipo de arquivo com "Limpar filtros", e aba "Histórico de Envios" por empresa (uma linha por e-mail: data/hora, competência | período, quantidade, categorias e responsável). Ações por arquivo: Visualizar, Baixar e Histórico de versões; sem edição dos arquivos importados automaticamente. 16 testes aprovados, build OK e tela autenticada conferida.


## Preparar fechamento
- [x] Buscar/anexar documentos esperados, mostrar resumo e permitir tentar novamente ou continuar sem bloqueio novo; "Concluir" reutiliza o salvamento atual.
- [x] Histórico privado append-only, importações registradas atomicamente por trigger após inserção do anexo; contexto, horário e responsável definidos pelo servidor. 33 testes aprovados; sessão autenticada com relatórios reais conferiu resumo completo, ausência simulada do Excel e registro da pendência antes do salvamento existente. Gravações interceptadas; persistência real do histórico não exercitada para evitar dados de teste na operação.

## Importar arquivos em Editar Movimentação
- [x] Identificação por nome/formato/contrato/tipo, competência explicitamente de destino e geração somente quando informada no nome; prévia reutilizada para PDF/imagens. 35 testes aprovados; sessão autenticada com arquivos reais confirmou aviso de 1 ignorado e prévia PDF. Gravações interceptadas, sem dados de teste na operação. Integração atual só disponibiliza PDF e XLS/XLSX, não há catálogo de outros formatos nem filtro histórico.
- [x] Adicionar busca de PDF/Excel pela integração existente e anexação à movimentação salva, preservando o envio manual e o salvamento; mês/período identificam o destino, pois a API atual consulta somente por contrato.
- [x] 19 testes aprovados e tela autenticada conferida com PDF/Excel reais do contrato 2171; gravações de anexos interceptadas, sem anexos de teste na operação. Contexto divergente/cancelado bloqueado; deduplicação agora por nome/contrato/competência/tipo conforme pedido posterior, sem substituir anexos. Persistência real não exercitada.

## Cartório 3 Ofício — primeira movimentação
- [x] Aplicado ao "Dashboard Geral" o limite da primeira competência em todos os gráficos da consulta comum; 14 testes aprovados, outubro 01-05 confirmado com 42 em vez de 43 e nenhum fora do prazo, sem apagar registros.
- [x] Corrigida a primeira competência do contrato 2548 para novembro/2026; dois registros de movimentação preservados, sem excluir anexos nem alterar cobranças.
- [x] Dez testes aprovados; tela autenticada confirmou ausência em outubro e presença em novembro, com filtro comum à lista, resumo e geração local; verificação automática sem erros.

## Consulta de relatório — 29/10
- [x] Exibir PDF e Excel independentemente, aceitar XLS/XLSX e manter arquivos identificados quando o carregamento falhar.
- [x] 19 testes aprovados; PDF e Excel reais do contrato 2171 baixados, ambos os blocos conferidos, falhas de download simuladas mantêm os nomes e nova tentativa; nenhum e-mail enviado.
- [x] Registrar histórico imutável só após sucesso do e-mail e exibir último envio, remetente e reenvios sem inventar dados antigos; gravação atômica por grupo e ID idempotente, data operacional mantida.
- [x] Testes de sucesso/falha e preservação aprovados; consulta autenticada de data antiga real e histórico simulado conferida, permissões de escrita/exclusão bloqueadas no banco e função publicada. Não realizado envio real para evitar mensagens da operação; novos históricos reais dependem do próximo envio.
- [x] Buscar apenas o PDF de vidas pela integração existente, mostrar busca/disponibilidade/ausência e nova tentativa, sem gerar arquivo local nem alterar movimentações. Data exibida apenas quando fornecida em Last-Modified; 15 testes aprovados, PDF real visualizado/baixado e ausência simulada recuperada com nova tentativa.
- [x] Simplificar somente "Visualizar relatório", mantendo geração e envio existentes.
- [x] Consulta autenticada do contrato 2171 sem campos editáveis, PDF real aberto e baixado, campos de envio preservados e 31 testes aprovados; nenhum e-mail enviado ou histórico alterado.

## Portal Empresa — relatórios reais por contrato (28/10)
- [x] Integrar fila assíncrona, PDF/Excel e visualização com contrato travado e cancelamento ao trocar a linha; PDF real ADATA 2490 (44 páginas) e Excel baixados, troca para 2192 limpa arquivos anteriores.
- [x] Integrar preparação e envio real individual/em lote, com validação do contrato também no servidor; envia somente após confirmação, e marca Enviado apenas após SMTP aceito.
- [x] Testar isolamento, divergências e consulta real sem enviar e-mails da operação; bloqueio real do servidor HTTP 400 ao apresentar trabalhos 2192 na movimentação 2490, tela sem erros. Entrega real de e-mail e gravação do lote não exercitadas para não disparar mensagens da operação.

## Arquivos próprios dos relatórios — pedido atual
- [x] Permitir anexar PDF e Excel no controle de relatório, separados dos anexos de "Editar Movimentação"; tabela e armazenamento privados próprios, preservando os arquivos antigos.
- [x] Envio atualizado para arquivos exclusivos do relatório; 14 testes aprovados, upload/reabertura e isolamento conferidos em sessão autenticada com gravação interceptada. Nenhum envio real realizado; persistência real não exercitada.

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

## Editar Movimentação — reorganização visual — 30/10
- [x] Janela dividida em 4 seções numeradas (1 Dados principais, 2 Datas e responsável, 3 Observações, 4 Anexos e fechamento); observações anteriores em leitura com "Nova observação" separada; anexos em bloco independente com contagem e botões; rodapé fixo com Cancelar/Salvar. Sem mudança de regras, campos, integrações ou salvamento. Build OK e janela conferida no navegador com as 4 seções renderizadas.
- [x] Layout interno dos campos: grade em pares, campos mais baixos (h-9), rótulos discretos, campos travados com visual de consulta (borda tracejada/fundo apagado), datas alinhadas. Seções Observações e Anexos refinadas: "Histórico de observações" + "Nova observação" separados; anexos com título "Anexos (N)", botões secundários em linha (Importar arquivos / Preparar fechamento / Anexar manualmente) e cards compactos com origem ("Importado automaticamente"/"Anexado manualmente"), tipo, tamanho e ações. Build OK e janela conferida no navegador.
