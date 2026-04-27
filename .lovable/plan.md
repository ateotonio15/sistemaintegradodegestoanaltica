## Objetivo

Na tela **Financeiro**, a coluna "Tipo" deve exibir os valores reais usados no setor financeiro: **NÃO-PRORATA**, **INCLUSÃO**, **INCLUSÃO/EXCLUSÃO** e **TAXA ADESÃO** — em vez de "Fechada" / "Diária".

O cadastro da empresa e as outras telas (Empresas, Movimentações, Dashboard) continuam usando "Fechada" / "Diária" normalmente. A mudança é **exclusiva da tela Financeiro**.

## O que muda

### 1. Novo campo no banco (apenas leitura/escrita pelo Financeiro)
Adicionar coluna `tipo_financeiro` em `empresas` (texto, nullable) com os 4 valores aceitos. Esse campo é independente do `tipo_movimentacao` (Fechada/Diária) que continua existindo e governando a lógica de período.

### 2. Backfill automático das empresas já mapeadas
Com base nas planilhas que você enviou, preencher `tipo_financeiro` nas empresas correspondentes:
- **NÃO-PRORATA**: AM Tecnologia, Barra Som, Best Notebooks, Dona Cardona Carne, DS da Amazônia, Instituto Everest, JAM Serviços, J de Souza Teles, Marcos Despachos, Navegação Cunha, Padaria Recife, Pioneiro Combustíveis, Wasion da Amazônia, Arcon Tube, Distribuidora Lopes, IPMEM, Edifício Black River, Arquidiocese Manaus, Bendsteel, Etor Pneus, Hisamatsu, Mene e Portela, VE Indústria
- **INCLUSÃO**: Manaus Ambiental, Nansen Instrumentos, Rio Negro Ambiental, Klabin da Amazônia, Klabin S/A, Minebea, Via Alvorada
- **INCLUSÃO/EXCLUSÃO**: Grupo Digitron (não encontrado), Profactory, Flextronics da Amazônia, Kawasaki Motores, Narda Engenharia, Saga Medical, Supermac
- **TAXA ADESÃO**: Distribuidora Lopes (substituindo o NÃO-PRORATA acima — vou tratar caso a caso conforme imagem)

### 3. Sincronizar `financeiro_movimentacoes.tipo_cobranca`
O campo `tipo_cobranca` da tabela `financeiro_movimentacoes` passa a receber o valor do `tipo_financeiro` da empresa (em vez de "Fechada"/"Diária"). Atualizar todos os registros existentes.

### 4. Front-end — apenas tela Financeiro
- **Coluna "Tipo"** da tabela financeira passa a mostrar `tipo_financeiro` (NÃO-PRORATA, INCLUSÃO, etc.)
- **Filtro "Tipo"** no topo passa a listar essas 4 opções
- **Diálogo de edição** ganha um select com os 4 valores
- **Gráfico de status por tipo** agrupa pelos novos valores
- **Exportação Excel** exporta o novo campo

### 5. Sem alteração em outras telas
- Cadastro de Empresa, Movimentações, Dashboard e Executivas continuam mostrando "Fechada" / "Diária".
- A lógica de cálculo de período (mês de referência vs. data de corte) continua usando `tipo_movimentacao` exatamente como hoje.

## Detalhes técnicos

- **Migração**: `ALTER TABLE empresas ADD COLUMN tipo_financeiro text;` + CHECK constraint com os 4 valores.
- **Backfill**: UPDATE em lote por nome de empresa (normalizado/case-insensitive).
- **Sincronização movimentações**: `UPDATE financeiro_movimentacoes fm SET tipo_cobranca = e.tipo_financeiro FROM empresas e WHERE fm.empresa_id = e.id AND e.tipo_financeiro IS NOT NULL;`
- **Trigger opcional** (recomendado): manter `financeiro_movimentacoes.tipo_cobranca` em sincronia automática quando `empresas.tipo_financeiro` mudar ou quando uma nova movimentação for criada.
- **Arquivos afetados (front)**:
  - `src/pages/Financeiro.tsx` — query inclui `tipo_financeiro`, filtro e exportação
  - `src/components/financeiro/FinanceiroTable.tsx` — coluna Tipo
  - `src/components/financeiro/EditarMovimentacaoDialog.tsx` — select com 4 opções
  - `src/components/financeiro/StatusChart.tsx` — agrupa pelos novos rótulos

## Empresas não encontradas (continuam sem tipo_financeiro)

Conforme já reportado: AR Rodriguez, Grupo Digitron, JAM Logística, NAV Cunha (Amazon Industria/Bacozon), Pioneiro Lubrificantes, Pioneiro Academia, Plural 1400/7500, Flextronics International, Kawasaki Componentes.