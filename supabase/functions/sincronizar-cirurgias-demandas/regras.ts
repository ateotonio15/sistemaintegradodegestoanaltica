export type DemandaCirurgia = { id: string; cpf: string | null; nome_cliente: string; setor_responsavel: string | null; tipo_reclamacao: string | null; reclamacao: string | null; resolvido_setor: boolean; resolvido_executiva: boolean };
export type Cirurgia = { nr_sequencia: number; dt_agenda: string; status?: { descricao?: string } | null; paciente?: { nr_cpf?: string } | null; medico?: { nm_medico?: string } | null };
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const digits = (s?: string | null) => (s ?? "").replace(/\D/g, "");
export const podeVerAvisosCirurgia = (role: string | null) => ["admin", "executivo", "executivo_externo"].includes(role ?? "");
export function demandaCirurgicaPendente(d: DemandaCirurgia) {
  return !d.resolvido_setor && !d.resolvido_executiva && digits(d.cpf).length === 11
    && /cirurg/.test(norm([d.setor_responsavel, d.tipo_reclamacao, d.reclamacao].join(" ")));
}
export function dataAgenda(s: string) {
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : (s.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "");
}
export function eventosConfirmados(demandas: DemandaCirurgia[], agenda: Cirurgia[], hoje: string) {
  const eventos = new Map<string, { demanda_id: string; agendamento_id: string; data_cirurgia: string; nome_paciente: string; nome_medico: string }>();
  for (const d of demandas.filter(demandaCirurgicaPendente)) {
    for (const a of agenda) {
      const status = norm(a.status?.descricao ?? "");
      const data = dataAgenda(a.dt_agenda);
      if (digits(a.paciente?.nr_cpf) !== digits(d.cpf) || !data || data < hoje
        || /cancel|realiz|conclu|executad|suspens|pendente|aguard|nao agend/.test(status)
        || !/agendad|confirmad|reservad/.test(status) || !a.nr_sequencia || !a.medico?.nm_medico?.trim()) continue;
      const event = { demanda_id: d.id, agendamento_id: String(a.nr_sequencia), data_cirurgia: data,
        nome_paciente: d.nome_cliente, nome_medico: a.medico.nm_medico.trim() };
      eventos.set(`${d.id}|${a.nr_sequencia}|${data}`, event);
    }
  }
  return [...eventos.values()];
}