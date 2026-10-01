# Cobrança "Aporte" na aba Arquivos

## O que o usuário vai ver
1. **Aba Arquivos → Enviar arquivo:** nova categoria **"Aporte"**. Ao escolher, aparecem dois campos obrigatórios:
   - Valor total do aporte (R$)
   - Quantidade de parcelas (1 a 24)
   - Mostra uma prévia: "6x de R$ 16,67 — Set/26 a Fev/27" (a partir da competência escolhida no envio).
2. **Pasta "Aporte"** nova nos filtros de pasta da aba Arquivos. O mesmo anexo aparece em **todas as competências** das parcelas (ex.: Set/26, Out/26, Nov/26, Dez/26, Jan/27, Fev/27), sem precisar enviar de novo.
3. **Faturamento:** nas competências com parcela, no lugar do card "Retroativo" aparece o card **"Aporte"**, com a parcela do mês (ex.: "Parcela 2/6 — R$ 16,67") e o anexo.
4. **Histórico (Gerar Histórico):** inclui a linha padrão
   `Aporte Financeiro 02/06. Data de vencimento: DD/MM/AAAA.`
   seguida do final de sempre da empresa: dados bancários de **depósito** (Banco Itaú...) ou **"O boleto está disponível no sistema de DDA"**, conforme o cadastro da empresa.

## Regras
- Valor da parcela = total ÷ parcelas, com arredondamento em centavos; a diferença fica na última parcela (soma sempre bate com o total).
- Parcela 1 = competência escolhida no envio; as demais seguem mês a mês.
- Vencimento de cada parcela usa o dia de vencimento já cadastrado da empresa naquela competência.
- Excluir o arquivo de aporte remove todas as parcelas.

## Detalhes técnicos
- Nova tabela `financeiro_aportes` (empresa_id, arquivo_id → financeiro_arquivos, valor_total, parcelas, competencia_inicial, created_by) e `financeiro_aporte_parcelas` (aporte_id, numero, competencia, valor). GRANTs + RLS com os mesmos perfis que já gravam em `financeiro_arquivos` (admin, financeiro, comum); cascade no delete.
- `UploadArquivoDialog.tsx`: campos condicionais para "Aporte" e criação do aporte + parcelas após inserir o arquivo.
- `Arquivos.tsx`: adicionar "Aporte" em `CATEGORIAS` (cor própria do chip) e expandir o arquivo para cada competência das parcelas.
- Faturamento: card de Aporte que substitui o card Retroativo quando existir parcela na competência (o card Retroativo continua normal quando não há aporte).
- `historico-utils.ts`: nova linha "Aporte Financeiro NN/TT. Data de vencimento: ..." reusando o bloco de depósito/DDA já existente (`pagamentoViaDeposito`).

## Ponto para confirmar
- Se a empresa tiver Retroativo **e** Aporte no mesmo mês, a proposta é mostrar o card Aporte no lugar do Retroativo, como você pediu. Se preferir ver os dois lado a lado, me diga.
