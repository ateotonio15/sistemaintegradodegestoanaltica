# SIGA — Visão Executiva (Diretoria)

Evolução do módulo de Relacionamento/Demandas para uma camada estratégica, sem alterar o que já existe. O dashboard de Demandas atual continua intacto; as novas telas entram ao lado dele.

Base de dados atual: 1.984 acionamentos (abr/2026 a set/2026), 9 setores, 136 empresas, 12 tipos de demanda. Nada será apagado ou substituído.

## 1. Novas telas

**Visão Executiva** — subtítulo "Inteligência de Relacionamento", visual claro corporativo fixo (independente do tema do usuário).

- Filtros no topo: período (3/6/12 meses ou personalizado), empresa, setor, executiva, tipo de demanda, status, origem — com "Aplicar" e "Limpar". Todos os blocos respondem aos filtros.
- 6 cards: Demandas no período, SLA, Backlog, Fora do prazo, Tempo médio de resposta (separando Agenda Cirúrgica dos demais), Resolutividade. Cada um com comparação ao período anterior e status automático (Saudável / Atenção / Crítico / Em evolução / Recuando) calculado pelas metas cadastradas.
- **Radar Executivo**: blocos de atenção imediata, observação e estáveis, gerados a partir dos dados (nenhum texto fixo), com link para a análise correspondente.
- **Evolução da Operação**: gráfico de linha mensal com escolha dos indicadores (demandas, SLA, backlog, resolutividade).
- **Distribuição das Demandas por Setor**: setor, quantidade, %, SLA, backlog, tempo médio; clique abre o detalhe do setor.
- **Resumo Executivo** e **Insights do período**: textos montados só a partir dos números filtrados, cada insight exibindo indicador afetado, período comparado e os valores que o sustentam.
- Botão **Exportar relatório** (Excel, CSV e PDF) respeitando os filtros.

**Performance dos Setores** — tabela Setor / Demandas / SLA / Backlog / Fora do prazo / Tempo médio / Resolutividade, com busca, ordenação, filtros e exportação. Clique abre a análise do setor: visão geral, ranking por tipo de demanda, evolução mensal, empresas mais envolvidas e reincidência (quantidade e %).

**Gargalos Operacionais** — combinações setor + tipo com maior volume, tempo médio e % fora do prazo, ordenáveis, sem ranking subjetivo de setores.

**Impacto na Carteira** — por empresa: demandas, reclamações, reincidências, SLA, tempo médio, resolutividade, evolução e classificação Baixa atenção / Atenção / Alta atenção, mostrando quais indicadores geraram a classificação (regras vindas das metas cadastradas).

**Perfil da Empresa** — página por empresa: resumo (nome, vidas quando disponível, período, total de acionamentos, SLA, reclamações, reincidências, resolutividade), histórico mensal, principais motivos, setores envolvidos e tendência (melhorando / estável / aumento). Nenhuma causa inventada.

**Metas e Parâmetros** — tela de administração para cadastrar meta, faixa de atenção e limite crítico de cada indicador (SLA, fora do prazo, backlog, tempo médio, resolutividade, reincidência) e os limites da classificação da carteira. Nada de valores fixos no código.

## 2. Novos campos do acionamento

Ampliação do cadastro de demandas, preservando os campos atuais:

- origem do acionamento, RH, corretora, colaborador, hora do acionamento
- status padronizado: Aberta, Em análise, Encaminhada, Aguardando retorno, Resolvida, Encerrada, Fora do prazo

Registros antigos continuam válidos: o status é derivado automaticamente das marcações de resolução que já existem, e os campos novos ficam em branco até serem preenchidos. Formulário de nova demanda, edição, importação e filtros passam a contemplar os campos novos.

## 3. Acesso por perfil

- **Diretoria**: Visão Executiva, Indicadores, Carteira, Análises, Relatórios.
- **Gestão / Admin**: tudo, incluindo Setores, Relacionamento e Metas.
- **Executiva / Relacionamento**: suas demandas, empresas e seus indicadores.

Os perfis já existentes do sistema são reaproveitados; nenhuma permissão atual é reduzida.

## 4. Navegação

Um agrupamento "Inteligência de Relacionamento" na régua lateral reúne Visão Executiva, Performance dos Setores, Gestão da Carteira, Análises e Metas, conforme o perfil. As entradas atuais de Demandas permanecem onde estão.

## Detalhes técnicos

- Banco: colunas novas em `public.demandas` (`origem`, `rh`, `corretora`, `colaborador`, `hora_acionamento`, `status`), com default compatível e backfill derivado de `resolvido_setor` / `resolvido_executiva`. Nova tabela `public.indicador_metas` (indicador, meta, limite de atenção, limite crítico, comparador) com GRANTs e RLS: leitura para autenticados, escrita apenas para Admin.
- Agregação: RPCs `SECURITY DEFINER` para os agregados por período/setor/empresa (KPIs, séries mensais, reincidência, gargalos), evitando trazer todas as linhas ao navegador; React Query com chave por filtro e paginação nas tabelas.
- Reaproveitamento: regras de SLA e fora do prazo de `src/lib/demandas-utils.ts` e das funções já usadas em `DemandasDashboard.tsx`, extraídas para um módulo compartilhado `src/modules/siga/lib/` sem alterar o comportamento da tela atual.
- Novas páginas em `src/modules/siga/pages/` com rotas `/siga`, `/siga/setores`, `/siga/setores/:setor`, `/siga/carteira`, `/siga/carteira/:empresa`, `/siga/analises`, `/siga/metas`; registro em `src/App.tsx` e itens em `src/components/AppLayout.tsx`.
- Visual: wrapper do módulo força o esquema claro; cores semânticas (verde/amarelo/vermelho/azul) via tokens do design system, sem classes de cor fixas.
- Exportações: Excel/CSV via a lib de planilhas já usada no projeto e PDF via o gerador existente em `src/lib`, sempre a partir do conjunto filtrado.
