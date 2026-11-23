// Regra do fechamento de movimentação (tela Movimentações):
// - "Salvar" NUNCA abre a janela de e-mail ao Financeiro: apenas grava o que foi digitado.
// - A janela de e-mail ("Envio direto ao Financeiro") só abre quando o usuário aperta
//   "Fechar sem ok da empresa", o contrato ainda não está fechado e a empresa não deu o ok.

export type DecisaoFechamento = {
  /** Abrir a janela de e-mail ao Financeiro após salvar. */
  abrirEmail: boolean;
  /** Valor a gravar em "Data Envio Financeiro". Null quando o e-mail ainda precisa ser enviado. */
  dataAserGravada: string | null;
};

export function decidirFechamentoMovimentacao(params: {
  /** true somente quando a ação veio do botão "Fechar sem ok da empresa". */
  fecharSemOk: boolean;
  /** true quando a movimentação já existe (edição); nunca no cadastro novo. */
  isEdicao: boolean;
  /** Data digitada em "Envio Financeiro". */
  dataEnvioFinanceiro: string | null;
  /** Data em "Confirmação da Empresa" (o ok da empresa). */
  dataRetornoEmpresa: string | null;
  /** true quando a movimentação já possui "Data Envio Financeiro" gravada. */
  jaFechado: boolean;
}): DecisaoFechamento {
  const empresaDeuOk = !!params.dataRetornoEmpresa;
  const abrirEmail =
    params.fecharSemOk &&
    params.isEdicao &&
    !!params.dataEnvioFinanceiro &&
    !empresaDeuOk &&
    !params.jaFechado;

  return { abrirEmail, dataAserGravada: abrirEmail ? null : params.dataEnvioFinanceiro };
}
