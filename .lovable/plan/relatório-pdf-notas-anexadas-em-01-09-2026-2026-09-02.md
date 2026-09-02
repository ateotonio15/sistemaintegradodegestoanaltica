# Relatório PDF — Notas anexadas em 01/09/2026

## O que foi verificado
- No dia 01/09/2026 foram anexados **113 arquivos de nota fiscal** (nome iniciando com "NF"), cobrindo **82 empresas**, todos na categoria Mensalidade e competência **2026-08**.
- As análises da competência 2026-08 existem por pagador em `financeiro_analises`, com valores separados (apartamento, enfermaria, inclusões, exclusões).

## O que será entregue
Um PDF (arquivo em /mnt/documents) com:

1. Capa/resumo: data de referência 01/09/2026, competência 2026-08, total de empresas, total de notas e valor total.
2. Tabela principal, uma linha por nota anexada:
   - Contrato e nome da empresa
   - Nome do arquivo da NF
   - Usuário que anexou e horário
   - Pagador correspondente (quando identificável)
   - Valor da análise do pagador
3. Quando a empresa tiver mais de um pagador, cada pagador aparece em sua própria linha, com subtotal por empresa.
4. Linhas sem análise correspondente ficam marcadas como "sem análise" para conferência manual.
5. Ordenação alfabética por empresa; totais ao final.

O status de envio não é usado como filtro — entram todas as empresas com nota anexada no dia.

## Detalhes técnicos
- Fonte dos anexos: `financeiro_arquivos` (categoria Mensalidade, `nome_original` iniciando com "NF", `created_at` no dia 01/09 no fuso de Manaus).
- Fonte dos valores: `financeiro_analises` de `mes_referencia = '2026-08'`, valor = soma de apartamento + enfermaria + inclusões + exclusões (base Excel, que é a preenchida).
- Vínculo empresa via `empresa_id`; pagadores casados por empresa (e por CNPJ quando o nome do arquivo permitir).
- Geração do PDF com ReportLab em script pontual, seguido de QA visual página a página. Sem alteração no código do sistema.
