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
/** Rótulos curtos do status do relatório para a coluna compacta "Relatório". */
const ROTULOS_CURTOS_RELATORIO: Record<string, string> = {
  "Não gerado": "Não gerado",
  "Gerando": "Gerando",
  "Pronto para envio": "Pronto",
  "Sem destinatário": "Sem e-mail",
  "Enviando": "Enviando",
  "Enviado": "Enviado",
  "Erro no envio": "Erro",
  "Conferido pela empresa": "Conferido",
  "Divergência informada": "Divergência",
};
export function rotuloCurtoRelatorio(status: string): string {
  return ROTULOS_CURTOS_RELATORIO[status] ?? status;
}
/** Classes do badge do relatório; apenas apresentação, não altera o status guardado. */
export function relatorioBadgeClass(status: string): string {
  switch (status) {
    case "Enviado":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40";
    case "Conferido pela empresa":
      return "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-emerald-600/40";
    case "Pronto para envio":
      return "bg-primary/15 text-primary border-primary/40";
    case "Gerando":
    case "Enviando":
      return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/40";
    case "Sem destinatário":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40";
    case "Erro no envio":
    case "Divergência informada":
      return "bg-destructive/15 text-destructive border-destructive/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}
/** Nome de exibição do arquivo do relatório de vidas (apenas apresentação). */
export function nomeArquivoRelatorio(empresaNome: string, mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split("-");
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const rotuloMes = meses[parseInt(mes, 10) - 1] ?? mes ?? "";
  const nome = empresaNome
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
    .toUpperCase() || "EMPRESA";
  return `RELATORIO_VIDAS_${nome}_${rotuloMes}-${ano}.xlsx`;
}
