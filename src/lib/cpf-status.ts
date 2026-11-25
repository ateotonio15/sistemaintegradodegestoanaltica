// Status de validação do CPF na Etapa 5 (Vidas Ativas).
// Nesta fase só há validação LOCAL; os estados oficiais ficam preparados
// para uma futura consulta externa (não realizada aqui).
export type StatusCpf =
  | "nao_analisado"
  | "invalido"
  | "valido_local"
  | "aguardando_oficial"
  | "validado_oficial"
  | "divergencia"
  | "nao_localizado"
  | "situacao_atencao"
  | "sem_data_nasc"
  | "indisponivel";

export const STATUS_CPF_LABEL: Record<StatusCpf, string> = {
  nao_analisado: "Não analisado",
  invalido: "Inválido",
  valido_local: "Válido localmente",
  aguardando_oficial: "Aguardando consulta oficial",
  validado_oficial: "Validado oficialmente",
  divergencia: "Divergência cadastral",
  nao_localizado: "CPF não localizado",
  situacao_atencao: "Situação cadastral com atenção",
  sem_data_nasc: "Consulta oficial não realizada — Data de nascimento indisponível",
  indisponivel: "Consulta indisponível",
};

/** Remove pontos, traços, espaços e qualquer outro caractere não numérico. */
export function normalizarCpf(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "");
}

/** Validação matemática local (tamanho, todos iguais e dígitos verificadores). */
export function cpfValidoLocal(v: string | null | undefined): boolean {
  const c = normalizarCpf(v);
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(c[9]) && calc(10) === parseInt(c[10]);
}

/** Status inicial: vazio = não analisado; inválido nunca vai para consulta externa. */
export function statusCpfLocal(v: string | null | undefined): StatusCpf {
  if (!normalizarCpf(v)) return "nao_analisado";
  return cpfValidoLocal(v) ? "valido_local" : "invalido";
}

/** Só CPFs válidos localmente ficam elegíveis para a consulta oficial futura. */
export function elegivelConsultaOficial(s: StatusCpf | undefined): boolean {
  return s === "valido_local" || s === "aguardando_oficial";
}

/** Exibe apenas os 2 últimos dígitos: ***.***.***-00 */
export function mascararCpf(v: string | null | undefined): string {
  const d = normalizarCpf(v);
  if (!d) return "—";
  return `***.***.***-${d.slice(-2).padStart(2, "*")}`;
}

export function resumoStatusCpf(lista: { cpf_status?: StatusCpf; cpf: string; cpf_oficial?: unknown }[]) {
  let validos = 0, invalidos = 0, aguardando = 0, naoAnalisados = 0;
  for (const b of lista) {
    const s = b.cpf_status ?? statusCpfLocal(b.cpf);
    if (s === "invalido") invalidos++;
    else if (s === "nao_analisado") naoAnalisados++;
    else {
      validos++;
      if (elegivelConsultaOficial(s) && !b.cpf_oficial) aguardando++;
    }
  }
  return { validos, invalidos, aguardando, naoAnalisados };
}

export interface ResultadoOficialCpf {
  status: Exclude<StatusCpf, "nao_analisado" | "invalido" | "valido_local" | "aguardando_oficial">;
  situacao?: string | null;
  origem: string;
  consultado_em: string;
}

/** Status final: resultado oficial (se houver) prevalece sobre o local; inválido local nunca é consultado. */
export function statusCpfFinal(b: { cpf: string; cpf_status?: StatusCpf; cpf_oficial?: ResultadoOficialCpf | null }): StatusCpf {
  const local = b.cpf_status ?? statusCpfLocal(b.cpf);
  if (local === "invalido" || local === "nao_analisado") return local;
  return b.cpf_oficial?.status ?? local;
}

export type CategoriaCpf = "validado" | "invalido" | "divergencia" | "situacao" | "nao_consultado";

/** Agrupa o status final nas categorias usadas em filtros e resumos. */
export function categoriaCpf(b: { cpf: string; cpf_status?: StatusCpf; cpf_oficial?: ResultadoOficialCpf | null }): CategoriaCpf {
  const s = statusCpfFinal(b);
  if (s === "validado_oficial") return "validado";
  if (s === "invalido") return "invalido";
  if (s === "divergencia" || s === "nao_localizado") return "divergencia";
  if (s === "situacao_atencao") return "situacao";
  return "nao_consultado";
}

/** Falha técnica/indisponível: pode ser tentada de novo; nunca é erro do beneficiário. */
export function precisaNovaTentativa(b: { cpf: string; cpf_status?: StatusCpf; cpf_oficial?: ResultadoOficialCpf | null }): boolean {
  return b.cpf_oficial?.status === "indisponivel" && statusCpfLocal(b.cpf) === "valido_local";
}

export interface ResumoValidacaoCpf {
  total: number; validados: number; invalidos: number; divergencias: number; alertas: number; nao_consultados: number; conferido_em: string | null;
}

export function resumoValidacaoCpf(lista: { cpf: string; cpf_status?: StatusCpf; cpf_oficial?: ResultadoOficialCpf | null }[]): ResumoValidacaoCpf {
  const r: ResumoValidacaoCpf = { total: lista.length, validados: 0, invalidos: 0, divergencias: 0, alertas: 0, nao_consultados: 0, conferido_em: null };
  for (const b of lista) {
    const c = categoriaCpf(b);
    if (c === "validado") r.validados++;
    else if (c === "invalido") r.invalidos++;
    else if (c === "divergencia") r.divergencias++;
    else if (c === "situacao") r.alertas++;
    else r.nao_consultados++;
    const t = b.cpf_oficial?.consultado_em;
    if (t && (!r.conferido_em || t > r.conferido_em)) r.conferido_em = t;
  }
  return r;
}

/** Pendências vindas da consulta oficial, no mesmo formato da lista de pendências existente. */
export function pendenciasCpfOficiais(lista: { linha: number; cpf: string; cpf_status?: StatusCpf; cpf_oficial?: ResultadoOficialCpf | null }[]) {
  const out: { linha: number; coluna: string; motivo: string; severidade: "erro" | "alerta" }[] = [];
  for (const b of lista) {
    const s = statusCpfFinal(b);
    if (s === "divergencia") out.push({ linha: b.linha, coluna: "CPF", motivo: "Divergência: CPF e Data de Nascimento não conferem", severidade: "alerta" });
    else if (s === "nao_localizado") out.push({ linha: b.linha, coluna: "CPF", motivo: "Divergência: CPF não localizado na consulta oficial", severidade: "alerta" });
    else if (s === "situacao_atencao") out.push({ linha: b.linha, coluna: "CPF", motivo: `Alerta: situação cadastral requer atenção${b.cpf_oficial?.situacao ? ` (${b.cpf_oficial.situacao})` : ""}`, severidade: "alerta" });
  }
  return out;
}
