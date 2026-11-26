import Papa from "papaparse";

export const normalizarUber = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export const primeiroNomeUber = (s: string) => s.trim().split(/\s+/)[0] ?? "";
const COLUNAS = ["Data da solicitação (local)", "Hora da solicitação (local)", "Nome", "Endereço de partida", "Endereço de destino", "Valor da transação: BRL", "ID da viagem/Uber Eats", "Serviço", "Tipo de cancelamento"];
export interface ViagemUber {
  uber_trip_id: string; data: string; horario: string; responsavel: string;
  setor_solicitante: string; origem: string; destino: string; valor: number;
  envio: boolean; cancelada: boolean; arquivos: string[];
}
export interface LinhaUber extends ViagemUber {
  selecionada: boolean; jaExiste: boolean; possivelDuplicata: boolean;
  colaborador: string; passageiro_id: string | null; motivo: string; tipo: string;
  empresa: string; forma_pagamento: string;
}
export function dataUber(s: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`Data inválida: ${s}`);
  const [, mes, dia, ano] = m;
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  if (d.getFullYear() !== Number(ano) || d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) throw new Error(`Data inválida: ${s}`);
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}
export function horaUber(s: string) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(s.trim());
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || Number(m[2]) > 59) throw new Error(`Horário inválido: ${s}`);
  return `${(Number(m[1]) % 12 + (m[3].toUpperCase() === "PM" ? 12 : 0)).toString().padStart(2, "0")}:${m[2]}`;
}
export function lerUberCsv(texto: string, arquivo: string) {
  // Metadata may not be CSV; parse only from the dynamically located header.
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/);
  const inicio = linhas.findIndex(l => normalizarUber(l.replace(/^"/, "")).startsWith("data da solicitacao"));
  if (inicio < 0) throw new Error(`${arquivo}: cabeçalho “Data da solicitação” não encontrado.`);
  const parsed = Papa.parse<string[]>(linhas.slice(inicio).join("\n"), { delimiter: ";", dynamicTyping: false, skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error(`${arquivo}: CSV inválido (${parsed.errors[0].message}).`);
  const [header, ...rows] = parsed.data;
  if (!header) throw new Error(`${arquivo}: cabeçalho vazio.`);
  const nomes = header.map(normalizarUber);
  const faltam = COLUNAS.filter(c => !nomes.includes(normalizarUber(c)));
  if (faltam.length) throw new Error(`${arquivo}: colunas obrigatórias ausentes: ${faltam.join(", ")}.`);
  const usados = [...COLUNAS, "Sobrenome", "Tipo de transação"].map(normalizarUber);
  if (usados.some(n => nomes.filter(h => h === n).length > 1)) throw new Error(`${arquivo}: cabeçalhos utilizados repetidos; revise o arquivo.`);
  const viagens: ViagemUber[] = [];
  let payments = 0;
  rows.forEach((cells, i) => {
    const linha = inicio + i + 2;
    if (cells.length !== header.length) throw new Error(`${arquivo}, linha ${linha}: quantidade de colunas incorreta.`);
    const get = (nome: string) => (cells[nomes.indexOf(normalizarUber(nome))] ?? "").trim();
    if (normalizarUber(get("Tipo de transação")) === "payment") { payments++; return; }
    const id = get("ID da viagem/Uber Eats");
    const raw = get("Valor da transação: BRL");
    if (!id) throw new Error(`${arquivo}, linha ${linha}: ID da viagem vazio.`);
    if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${arquivo}, linha ${linha}: valor inválido.`);
    try {
      viagens.push({ uber_trip_id: id, data: dataUber(get(COLUNAS[0])), horario: horaUber(get(COLUNAS[1])),
        responsavel: primeiroNomeUber(get("Nome")), setor_solicitante: get("Sobrenome"),
        origem: get("Endereço de partida"), destino: get("Endereço de destino"), valor: Number(raw),
        envio: normalizarUber(get("Serviço")).includes("envios"),
        cancelada: !["", "--"].includes(get("Tipo de cancelamento")), arquivos: [arquivo] });
    } catch (e) { throw new Error(`${arquivo}, linha ${linha}: ${e instanceof Error ? e.message : "dados inválidos"}`); }
  });
  return { viagens, linhasLidas: rows.length, payments };
}
export function agruparUber(viagens: ViagemUber[]) {
  const grupos = new Map<string, ViagemUber>();
  for (const v of viagens) {
    const anterior = grupos.get(v.uber_trip_id);
    if (!anterior) grupos.set(v.uber_trip_id, { ...v, arquivos: [...v.arquivos], valor: Math.round(v.valor * 100) / 100 });
    else {
      anterior.valor = (Math.round(anterior.valor * 100) + Math.round(v.valor * 100)) / 100;
      anterior.envio ||= v.envio; anterior.cancelada ||= v.cancelada;
      anterior.arquivos = Array.from(new Set([...anterior.arquivos, ...v.arquivos]));
    }
  }
  return [...grupos.values()];
}
export function casarResponsavel(nome: string, responsaveis: string[]) {
  const encontrados = responsaveis.filter(r => normalizarUber(primeiroNomeUber(r)) === normalizarUber(primeiroNomeUber(nome)));
  return encontrados.length === 1 ? encontrados[0] : "";
}
export function conferirUber(viagens: ViagemUber[], existentes: { uber_trip_id?: string | null; data: string; horario: string | null; valor: number }[], responsaveis: string[]): LinhaUber[] {
  const ids = new Set(existentes.map(c => c.uber_trip_id).filter(Boolean));
  const chaves = new Set(existentes.map(c => `${c.data}|${c.horario?.slice(0, 5)}|${Math.round(Number(c.valor) * 100)}`));
  return viagens.map(v => {
    const jaExiste = ids.has(v.uber_trip_id);
    const possivelDuplicata = !jaExiste && chaves.has(`${v.data}|${v.horario}|${Math.round(v.valor * 100)}`);
    return { ...v, responsavel: casarResponsavel(v.responsavel, responsaveis), jaExiste, possivelDuplicata,
      selecionada: !jaExiste && !possivelDuplicata && !v.envio, colaborador: "", passageiro_id: null,
      motivo: v.envio ? "Envio de Material" : "", tipo: "", empresa: "", forma_pagamento: "" };
  });
}
export function pendenciasUber(v: Pick<LinhaUber, "colaborador" | "responsavel" | "motivo" | "tipo" | "empresa" | "forma_pagamento">) {
  // The current ride form requires only a collaborator. Other fields remain optional.
  return v.colaborador.trim() ? [] : ["Colaborador"];
}