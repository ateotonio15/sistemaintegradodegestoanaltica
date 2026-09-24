# Importar reajustes da API Samel para o histórico

## O que o usuário verá
- Na página Reajustes, um botão **"Sincronizar reajustes da operadora"**.
- Ao clicar, o sistema busca os reajustes por contrato na API da Samel e mostra uma prévia: contrato, empresa, % de reajuste, data, planos (Enfermaria/Apartamento) e valores por faixa etária.
- A prévia indica para cada contrato: **Novo**, **Já registrado** (mesmo contrato + ano) ou **Contrato não encontrado** no sistema.
- Ao confirmar, os contratos com reajuste do ano atual e dos anos seguintes entram no histórico como **Reajustado (origem: API operadora)**, com valores por faixa.
- Contratos que já tinham reajuste do mesmo ano não são duplicados.

## Regras
- Vínculo contrato: `NR_CONTRATO` da API = código do contrato da empresa.
- Ano/mês do reajuste vêm de `DT_REAJUSTE`; apenas ano >= ano atual.
- Plano "Coletivo Empresarial Master" = Enfermaria; "Master Executivo" = Apartamento (mesma regra já usada no sistema).
- `VL_PRECO_ATUAL` é tratado como valor já reajustado; o valor anterior é calculado de volta pelo percentual (`valor / (1 + TX/100)`). Enfermaria e Apartamento sempre separados, nunca somados.
- Faixa única 0–999 grava valor único; várias faixas gravam as faixas etárias.
- Cada importação registra evento na linha do tempo do reajuste.

## Detalhes técnicos
- Nova função de backend `reajustes-operadora-proxy` (mesmo padrão de `vidas-operadora-proxy`, com validação de login) chamando `https://api-iasam.samel.com.br/reajuste-contratos/agrupado`.
- Novo `src/lib/reajustesOperadoraApi.ts` (fetch + mapeamento) e `ImportarReajustesOperadoraDialog.tsx` em `src/components/reajustes/`.
- Grava em `reajustes_anuais` (status_reajuste `reajustado`, `percentual`, `mes_reajuste`, `ano`, `data_aplicacao`, valores antigos/reajustados por categoria, `observacao` "Importado da API operadora"), `reajuste_faixas` e `reajustes_historico`.
- Botão visível apenas para Admin/Cadastro/Diretoria.

## Ponto a confirmar
Se `VL_PRECO_ATUAL` for o preço **antes** do reajuste, o cálculo inverte (valor reajustado = atual × (1 + TX/100)).
