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
export function relatorioAptoParaEnvio(registro?: RegistroRelatorio): boolean {
  return registro?.status === "Pronto para envio" && !!registro.destinatarios.trim() && registro.confirmacao === "Aguardando";
}
export function resumoEnvioRelatorios(ids: string[], registros: ReadonlyMap<string, RegistroRelatorio>) {
  const enviados = ids.filter(id => {
    const registro = registros.get(id);
    return !!registro?.data_envio && ["Enviado", "Conferido pela empresa", "Divergência informada"].includes(registro.status);
  }).length;
  return { total: ids.length, enviados, pendentes: ids.length - enviados };
}
export function selecionarLoteRelatorios<T extends { id: string; empresa_id: string; periodo: string; mes_referencia: string }>(
  filtrados: T[], registros: ReadonlyMap<string, RegistroRelatorio>, mes: string, periodos: readonly string[],
): T[] {
  return filtrados.filter(m => !!m.empresa_id && m.mes_referencia === mes && periodos.includes(m.periodo) && relatorioAptoParaEnvio(registros.get(m.id)));
}
export function validarRegistroRelatorio(r: RegistroRelatorio): string | null {
  if (!STATUS_RELATORIO.some(s => s === r.status) || !CONFIRMACOES_RELATORIO.some(c => c === r.confirmacao)) return "Selecione um status e uma confirmação válidos.";
  if ((["Enviado", "Conferido pela empresa", "Divergência informada"].includes(r.status) || r.confirmacao !== "Aguardando") && (!r.destinatarios.trim() || !r.data_envio)) return "Informe os destinatários e a data de envio.";
  if ((r.confirmacao !== "Aguardando" && r.status !== r.confirmacao) || (["Conferido pela empresa", "Divergência informada"].includes(r.status) && r.confirmacao !== r.status)) return "A confirmação deve corresponder ao status do relatório.";
  return null;
}