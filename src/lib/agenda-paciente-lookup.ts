import {
  listarAgendamentos,
  listarAgendamentosDireto,
  lerChaveDireta,
  lerModoAgenda,
  type AgendamentoCirurgico,
} from "@/lib/agendaCirurgicaApi";

export type DadosCirurgiaPaciente = {
  data_entrada: string; // yyyy-MM-dd
  nome_medico: string;
  nome_procedimento: string;
};

export type ConsultaAgendaPaciente = {
  cirurgia: DadosCirurgiaPaciente | null;
  agendamentoAtivo: DadosCirurgiaPaciente | null;
};

/** Só identifica como ativo um status explicitamente agendado/confirmado, nunca desconhecido. */
export function cirurgiaAgendadaAtiva(a: AgendamentoCirurgico, hojeIso: string): boolean {
  const descricao = (a.status?.descricao ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const data = normalizarDataAgenda(a.dt_agenda);
  return !!data && data >= hojeIso
    && !/cancel|realiz|conclu|executad|suspens|pendente|aguard|nao agend/.test(descricao)
    && /agendad|confirmad|reservad/.test(descricao);
}

const soDigitos = (s?: string | null) => String(s ?? "").replace(/\D/g, "");
const br = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

/** Converte "DD/MM/YYYY" ou "YYYY-MM-DD..." para "YYYY-MM-DD". */
export function normalizarDataAgenda(s?: string | null): string {
  const v = String(s ?? "").trim();
  const m1 = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2]}-${m1[1]}`;
  const m2 = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? `${m2[1]}-${m2[2]}-${m2[3]}` : "";
}

/** Escolhe o agendamento do CPF mais próximo de hoje (prioriza futuros). */
export function escolherAgendamento(lista: AgendamentoCirurgico[], cpf: string, hojeIso: string): DadosCirurgiaPaciente | null {
  const alvo = soDigitos(cpf);
  if (alvo.length !== 11) return null;
  const doCpf = lista
    .filter((a) => soDigitos(a.paciente?.nr_cpf) === alvo)
    .map((a) => ({ a, data: normalizarDataAgenda(a.dt_agenda) }))
    .filter((x) => x.data);
  if (!doCpf.length) return null;
  const futuros = doCpf.filter((x) => x.data >= hojeIso).sort((x, y) => x.data.localeCompare(y.data));
  const passados = doCpf.filter((x) => x.data < hojeIso).sort((x, y) => y.data.localeCompare(x.data));
  const { a, data } = futuros[0] ?? passados[0];
  return {
    data_entrada: data,
    nome_medico: a.medico?.nm_medico?.trim() || "",
    nome_procedimento: (a.procedimento_principal?.descricao || a.procedimentos?.[0]?.descricao || "").trim(),
  };
}

/**
 * Busca na agenda cirúrgica (via servidor protegido) os dados da cirurgia do paciente.
 * A API filtra por nome; a correspondência final é feita pelo CPF completo.
 * Retorna null quando não encontrado ou quando a agenda não responde.
 */
export async function buscarAgendaPaciente(cpf: string, nome: string): Promise<ConsultaAgendaPaciente | null> {
  if (soDigitos(cpf).length !== 11 || nome.trim().length < 3) return null;
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 6, hoje.getDate());
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 6, hoje.getDate());
  const filtros = { dt_inicio: br(ini), dt_fim: br(fim), nm_paciente: nome.trim(), limit: 200 };
  // Mesmo modo de acesso da tela da Agenda Cirúrgica: a API só responde na rede interna/VPN.
  const direto = () => listarAgendamentosDireto(filtros, lerChaveDireta());
  let r;
  if (lerModoAgenda() === "direto") {
    r = await direto();
  } else {
    try { r = await listarAgendamentos(filtros); } catch { r = await direto(); }
  }
  const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  if (!r?.sucesso || !Array.isArray(r.dados)) throw new Error("A agenda não retornou uma consulta válida.");
  const lista = [...r.dados];
  // A pesquisa por nome pode retornar homônimos em outras páginas; o CPF completo decide o vínculo.
  for (let page = 2; page <= r.total_paginas; page++) {
    const pagina = lerModoAgenda() === "direto"
      ? await listarAgendamentosDireto({ ...filtros, page }, lerChaveDireta())
      : await listarAgendamentos({ ...filtros, page }).catch(() => listarAgendamentosDireto({ ...filtros, page }, lerChaveDireta()));
    if (!pagina?.sucesso || !Array.isArray(pagina.dados)) throw new Error("Consulta da agenda incompleta.");
    lista.push(...pagina.dados);
  }
  return {
    cirurgia: escolherAgendamento(lista, cpf, hojeIso),
    agendamentoAtivo: escolherAgendamento(lista.filter(a => cirurgiaAgendadaAtiva(a, hojeIso)), cpf, hojeIso),
  };
}

export async function buscarCirurgiaPorCpf(cpf: string, nome: string): Promise<DadosCirurgiaPaciente | null> {
  return (await buscarAgendaPaciente(cpf, nome))?.cirurgia ?? null;
}
