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
export const STATUS_FINAIS_RELATORIO = ["Enviado", "Conferido pela empresa", "Divergência informada"] as const;
export function relatorioFinalizado(registro?: RegistroRelatorio): boolean {
  return !!registro && STATUS_FINAIS_RELATORIO.some(s => s === registro.status);
}
/** Classifica uma movimentação no "Preparar Relatórios": finais nunca são reabertos. */
export function classificarPreparacao(registro: RegistroRelatorio | undefined, destinatarios: string): "final" | "pronto" | "sem_destinatario" {
  if (relatorioFinalizado(registro)) return "final";
  return destinatarios.trim() ? "pronto" : "sem_destinatario";
}
/** Resumo da confirmação de envio: só as aptas são enviadas; as demais não bloqueiam o lote. */
export function resumoLoteEnvio<T extends { id: string }>(itens: T[], registros: ReadonlyMap<string, RegistroRelatorio>) {
  let prontas = 0, semDestinatario = 0, comErro = 0;
  const aptas: T[] = [];
  for (const item of itens) {
    const registro = registros.get(item.id);
    if (registro && relatorioAptoParaEnvio(registro)) { prontas++; aptas.push(item); continue; }
    if (!registro || relatorioFinalizado(registro)) { comErro++; continue; }
    if (!registro.destinatarios.trim() || registro.status === "Sem destinatário") semDestinatario++;
    else comErro++;
  }
  return { selecionadas: itens.length, prontas, semDestinatario, comErro, aptas };
}
export function validarRegistroRelatorio(r: RegistroRelatorio): string | null {
  if (!STATUS_RELATORIO.some(s => s === r.status) || !CONFIRMACOES_RELATORIO.some(c => c === r.confirmacao)) return "Selecione um status e uma confirmação válidos.";
  if ((["Enviado", "Conferido pela empresa", "Divergência informada"].includes(r.status) || r.confirmacao !== "Aguardando") && (!r.destinatarios.trim() || !r.data_envio)) return "Informe os destinatários e a data de envio.";
  if ((r.confirmacao !== "Aguardando" && r.status !== r.confirmacao) || (["Conferido pela empresa", "Divergência informada"].includes(r.status) && r.confirmacao !== r.status)) return "A confirmação deve corresponder ao status do relatório.";
  return null;
}