// Regras puras da varredura da Agenda Cirúrgica nas reclamações.
// Nunca alteram a reclamação nem a agenda: só classificam o que a API devolveu.
export type Situacao = "agendada" | "aguardando" | "realizado" | "cancelado" | "validar" | "erro";
export type DemandaVarredura = {
  id: string; cpf: string | null; nome_cliente: string; setor_responsavel: string | null;
  tipo_reclamacao: string | null; reclamacao: string | null; resolvido_setor: boolean; resolvido_executiva: boolean;
};
export type Agendamento = {
  nr_sequencia?: number; dt_agenda?: string; status?: { codigo?: string; descricao?: string } | null;
  paciente?: { nm_paciente?: string; nr_cpf?: string } | null;
};
export type Resultado = { situacao: Situacao; data_procedimento: string | null; status_api: string | null; agendamento_id: string | null };

export const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
export const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");

/** Pendente (nem setor nem executiva resolveram) e com qualquer menção a cirurgia. */
export function elegivel(d: DemandaVarredura) {
  return !d.resolvido_setor && !d.resolvido_executiva
    && /cirurg/.test(norm([d.setor_responsavel, d.tipo_reclamacao, d.reclamacao].join(" ")));
}

export function dataAgenda(s?: string) {
  if (!s) return "";
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : (s.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "");
}

const NEGATIVO = /cancel|realiz|conclu|executad|suspens|pendente|aguard|nao agend|solicit|autoriz|previs/;
const ATIVO = /agendad|confirmad|reservad|\bmarcad[ao]\b/;
const REALIZADO = /realiz|conclu|executad/;
const CANCELADO = /cancel|suspens/;

/**
 * Classifica a reclamação com base nos agendamentos devolvidos pela busca por nome.
 * CPF é o critério decisivo; nome completo idêntico sem CPF compatível vira "validar".
 */
export function classificar(d: DemandaVarredura, agenda: Agendamento[], hoje: string): Resultado {
  const vazio = { data_procedimento: null, status_api: null, agendamento_id: null };
  const cpf = digits(d.cpf);
  const nome = norm(d.nome_cliente);
  const mesmoNome = agenda.filter((a) => norm(a.paciente?.nm_paciente) === nome);
  if (cpf.length !== 11) return { situacao: mesmoNome.length || nome.length < 3 ? "validar" : "aguardando", ...vazio };
  const doPaciente = agenda.filter((a) => digits(a.paciente?.nr_cpf) === cpf);
  if (!doPaciente.length) return { situacao: mesmoNome.length ? "validar" : "aguardando", ...vazio };
  const info = (a: Agendamento, situacao: Situacao): Resultado => ({
    situacao, data_procedimento: dataAgenda(a.dt_agenda) || null,
    status_api: (a.status?.descricao || a.status?.codigo || "").trim() || null,
    agendamento_id: a.nr_sequencia ? String(a.nr_sequencia) : null,
  });
  const comData = doPaciente.filter((a) => dataAgenda(a.dt_agenda));
  const st = (a: Agendamento) => norm(a.status?.descricao);
  const ativos = comData.filter((a) => dataAgenda(a.dt_agenda) >= hoje && ATIVO.test(st(a)) && !NEGATIVO.test(st(a)))
    .sort((a, b) => dataAgenda(a.dt_agenda).localeCompare(dataAgenda(b.dt_agenda)));
  if (ativos.length) return info(ativos[0], "agendada");
  const recentes = (re: RegExp) => comData.filter((a) => re.test(st(a)))
    .sort((a, b) => dataAgenda(b.dt_agenda).localeCompare(dataAgenda(a.dt_agenda)));
  const realizados = recentes(REALIZADO);
  if (realizados.length) return info(realizados[0], "realizado");
  const cancelados = recentes(CANCELADO);
  if (cancelados.length) return info(cancelados[0], "cancelado");
  return { situacao: "aguardando", ...vazio };
}

export const assinatura = (r: Resultado) => [r.situacao, r.data_procedimento, r.status_api, r.agendamento_id].join("|");
