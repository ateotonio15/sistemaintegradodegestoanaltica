import type { PendenteProcedimentoItem } from "./agendaCirurgicaApi";

export type StatusPendente = "todos" | "risco" | "vencidos" | "prazo";
export function correspondeStatus(dias: number, status: StatusPendente) {
  if (status === "risco") return dias >= 0 && dias <= 2;
  if (status === "vencidos") return dias < 0;
  if (status === "prazo") return dias > 2;
  return true;
}
export const tomDias = (dias: number) => dias <= 2 ? "danger" : dias <= 5 ? "warning" : "success";
export function metricasPendentes(dados: PendenteProcedimentoItem[]) {
  return { total: dados.length, proximo: dados.length ? Math.min(...dados.map(d => d.dias_para_execucao)) : null, risco: dados.filter(d => d.dias_para_execucao <= 2).length };
}
export function formatarCnpjAgenda(cnpj: string | null) {
  const n = (cnpj ?? "").replace(/\D/g, "");
  return n.length === 14 ? n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : cnpj || "—";
}
export function formatarDataAgenda(valor: string, hora = false) {
  if (!valor) return "—";
  const iso = valor.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}${hora && iso[4] ? ` ${iso[4]}` : ""}`;
  return hora ? valor : valor.split(/[T ]/)[0];
}
/** Lê apenas a hora (HH:mm) de valores que chegam como "HH:mm:ss" ou data/hora completa. */
export function formatarHoraAgenda(valor: string | null | undefined) {
  if (!valor) return "";
  const t = valor.match(/(?:^|[T ])(\d{2}):(\d{2})/);
  return t ? `${t[1]}:${t[2]}` : valor;
}
export function linhasPendentes(dados: PendenteProcedimentoItem[]) {
  return dados.map(d => ({ Paciente: d.nm_paciente, Procedimento: `${d.cd_procedimento} - ${d.ds_procedimento}`, Empresa: d.empresa, CNPJ: formatarCnpjAgenda(d.cd_cgc_estipulante), "Data Agendada": formatarDataAgenda(d.dt_agenda, true), "Agendado em": formatarDataAgenda(d.dt_agendamento), "Dias p/ Execução": d.dias_para_execucao, Atendimento: d.nr_atendimento ?? "" }));
}
export const celulaCsvSegura = (valor: unknown) => `"${String(valor ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;