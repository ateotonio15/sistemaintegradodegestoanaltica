export const STATUS_RELATORIO = ["Não gerado", "Gerando", "Pronto para envio", "Sem destinatário", "Enviando", "Enviado", "Erro no envio", "Conferido pela empresa", "Divergência informada"] as const;
export const CONFIRMACOES_RELATORIO = ["Aguardando", "Conferido pela empresa", "Divergência informada"] as const;
export type RegistroRelatorio = {
  status: string;
  destinatarios: string;
  data_envio: string | null;
  confirmacao: string;
  observacoes: string;
};
export const RELATORIO_VAZIO: RegistroRelatorio = { status: "Não gerado", destinatarios: "", data_envio: null, confirmacao: "Aguardando", observacoes: "" };
export function validarRegistroRelatorio(r: RegistroRelatorio): string | null {
  if (!STATUS_RELATORIO.some(s => s === r.status) || !CONFIRMACOES_RELATORIO.some(c => c === r.confirmacao)) return "Selecione um status e uma confirmação válidos.";
  if ((["Enviado", "Conferido pela empresa", "Divergência informada"].includes(r.status) || r.confirmacao !== "Aguardando") && (!r.destinatarios.trim() || !r.data_envio)) return "Informe os destinatários e a data de envio.";
  if ((r.confirmacao !== "Aguardando" && r.status !== r.confirmacao) || (["Conferido pela empresa", "Divergência informada"].includes(r.status) && r.confirmacao !== r.status)) return "A confirmação deve corresponder ao status do relatório.";
  return null;
}