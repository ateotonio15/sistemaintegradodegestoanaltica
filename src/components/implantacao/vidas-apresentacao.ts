import { pendenciasCpfOficiais, statusCpfLocal } from "@/lib/cpf-status";
import type { BeneficiarioLido, ValidacaoResultado } from "@/lib/relatorio-vidas-validator";

// Presentation capability only: the official adapter currently has no provider.
// Keep this aligned with consultarServico when a provider is actually connected.
export const CONSULTA_OFICIAL_CONFIGURADA = false;

export type FiltroParticipantes = "todos" | "titulares" | "dependentes" | "pendencias";

export function temPendenciaParticipante(b: BeneficiarioLido, validacao: ValidacaoResultado, consultaConfigurada: boolean) {
  return validacao.pendencias.some((p) => p.linha === b.linha)
    || statusCpfLocal(b.cpf) === "invalido"
    || (consultaConfigurada && (pendenciasCpfOficiais([b]).length > 0 || b.cpf_oficial?.status === "indisponivel" || b.cpf_oficial?.status === "sem_data_nasc"));
}

export function filtrarParticipante(b: BeneficiarioLido, filtro: FiltroParticipantes, validacao: ValidacaoResultado, consultaConfigurada: boolean) {
  if (filtro === "titulares") return b.tipo === "TITULAR";
  if (filtro === "dependentes") return b.tipo !== "TITULAR";
  if (filtro === "pendencias") return temPendenciaParticipante(b, validacao, consultaConfigurada);
  return true;
}