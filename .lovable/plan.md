## Diagnóstico

O parser do PDF Moto Honda **já está correto** (testado contra o seu PDF real, extrai `beneficiários=16353`, `inclusões=R$ 34.463,50`, `exclusões=-R$ 6.976,73`).

A tela continua mostrando "—" porque `runAnalise` em `src/pages/Financeiro.tsx` (linhas 493–501) usa um cache em memória cuja chave é só `storage_path + tipo_analise`. Como nenhum dos dois mudou desde a última análise, o React reaproveita o resultado **antigo** (gerado antes do hotfix do parser) e nem chama o parser novo.

Ou seja: nada está quebrado no parser — está quebrado o **mecanismo de invalidação**.

## O que vou fazer

### 1. Botão "Reanalisar" (forçar)
Em `AnaliseExcelRow.tsx` (ou no header da seção de análise dentro do `FinanceiroTable.tsx`), adicionar um botão pequeno **"Reanalisar"** ao lado do título, que chama `runAnalise(row, { force: true })`.

### 2. `runAnalise` com flag `force`
Em `src/pages/Financeiro.tsx`:
- Adicionar parâmetro opcional `{ force?: boolean }`.
- Quando `force === true`, pular o early-return da linha 499 e rodar tudo de novo.

### 3. Versionar a chave do cache
Adicionar uma constante `ANALISE_PARSER_VERSION = "2"` no topo do arquivo e incluí-la no `cacheKey`:
```
cacheKey = storagePaths + "::" + tipoAnalise + "::v" + ANALISE_PARSER_VERSION
```
Sempre que mexermos no parser no futuro, basta bumpar a versão e todos os caches existentes ficam automaticamente inválidos. Isso resolve definitivamente o problema que você está vendo agora.

### 4. (UX) Reanalisar automaticamente após troca de "Tipo de análise"
Já é coberto pelo `cacheKey` atual (que inclui `tipo_analise`), mas vou validar visualmente — sem mudança de código se já estiver ok.

## Arquivos tocados

- `src/pages/Financeiro.tsx` — flag `force` + versão no cache key.
- `src/components/financeiro/AnaliseExcelRow.tsx` — botão "Reanalisar".

## Resultado esperado

Depois do fix, ao abrir a movimentação Moto Honda você verá no bloco "Validação simplificada":

| Campo | Excel | PDF | OK |
|---|---|---|---|
| Total beneficiários | 16353 | 16353 | ✓ |
| Inclusões (valor) | R$ 34.463,50 | R$ 34.463,50 | ✓ |
| Exclusões (valor) | -R$ 6.976,73 | -R$ 6.976,73 | ✓ |

Sem divergências.

## Alternativa rápida (sem código)

Se preferir só validar agora, basta dar **Ctrl+Shift+R** na página `/financeiro` e abrir a movimentação de novo — o cache em memória é limpo no reload e o parser corrigido será chamado. O plano acima evita que isso seja necessário no futuro.