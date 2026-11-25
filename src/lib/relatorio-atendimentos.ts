// Cálculos agregados (sem dados pessoais) do relatório visual de atendimentos.
export interface AtendRel {
  data: string; // YYYY-MM-DD (data do plantão, horário de Manaus)
  hora: string | null;
  cpf: string | null;
  tipo: string;
  canal: string;
  resolvido: boolean;
  motivo: string | null;
  especialidade: string | null;
}

const cont = (arr: string[]) => {
  const m = new Map<string, number>();
  arr.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()].map(([nome, qtd]) => ({ nome, qtd })).sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome));
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function validarPeriodo(de: string, ate: string): string | null {
  const ok = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00").getTime());
  if (!ok(de) || !ok(ate)) return "Informe datas válidas em \"De\" e \"Até\".";
  if (ate < de) return "A data \"Até\" não pode ser anterior à data \"De\".";
  return null;
}

/** Período anterior com o mesmo número de dias, imediatamente antes de "de". */
export function periodoAnterior(de: string, ate: string) {
  const d = new Date(de + "T00:00:00"), a = new Date(ate + "T00:00:00");
  const dias = Math.round((a.getTime() - d.getTime()) / 86400000) + 1;
  const fim = new Date(d); fim.setDate(fim.getDate() - 1);
  const ini = new Date(fim); ini.setDate(ini.getDate() - (dias - 1));
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { de: iso(ini), ate: iso(fim) };
}

const horaDe = (h: string | null) => {
  const m = /^(\d{1,2})/.exec(h ?? "");
  const n = m ? Number(m[1]) : NaN;
  return n >= 0 && n <= 23 ? n : null;
};

export function calcularRelatorio(rows: AtendRel[]) {
  const total = rows.length;
  const resolvidos = rows.filter((r) => r.resolvido).length;
  const cpfs = new Set(rows.map((r) => (r.cpf ?? "").replace(/\D/g, "")).filter(Boolean));
  const porDiaMap = cont(rows.map((r) => r.data));
  const porDia = [...porDiaMap].sort((a, b) => a.nome.localeCompare(b.nome));
  const motivos = cont(rows.map((r) => r.motivo || "Outros"));
  const app = rows.filter((r) => r.motivo === "Dificuldade com o app Samel").length;
  const consultas = rows.filter((r) => (r.motivo || "") === "Consulta com especialista");
  const especialidades = cont(consultas.map((r) => r.especialidade || "Outras especialidades"));
  const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, qtd: 0 }));
  rows.forEach((r) => { const h = horaDe(r.hora); if (h !== null) horas[h].qtd++; });
  const comHora = horas.filter((h) => h.qtd > 0);
  const porHora = comHora.length ? horas.slice(Math.min(...comHora.map((h) => h.hora)), Math.max(...comHora.map((h) => h.hora)) + 1) : [];
  let pico: { inicio: number; fim: number; qtd: number } | null = null;
  for (let h = 0; h < 23; h++) {
    const q = horas[h].qtd + horas[h + 1].qtd;
    if (q > 0 && (!pico || q > pico.qtd)) pico = { inicio: h, fim: h + 2, qtd: q };
  }
  const canais = cont(rows.map((r) => r.canal || "Presencial"));
  const tipos = cont(rows.map((r) => r.tipo || "Outros"));
  const abertos = rows.filter((r) => !r.resolvido);
  return {
    total, resolvidos, abertos: abertos.length,
    pctResolvidos: pct(resolvidos, total),
    clientesUnicos: cpfs.size,
    mediaPorDia: porDia.length ? Math.round((total / porDia.length) * 10) / 10 : 0,
    diasComRegistro: porDia.length,
    app, pctApp: pct(app, total),
    porDia, porHora, pico, motivos,
    totalConsultas: consultas.length, especialidades,
    canais: canais.map((c) => ({ ...c, pct: pct(c.qtd, total) })),
    tipos,
    abertosPorMotivo: cont(abertos.map((r) => r.motivo || "Outros")),
    naoClassificados: rows.filter((r) => !r.motivo).length,
  };
}
export type Relatorio = ReturnType<typeof calcularRelatorio>;

export function variacao(atual: number, anterior: number) {
  if (!anterior) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}

export function gerarDestaques(r: Relatorio, ant?: Relatorio | null): string[] {
  const f = (n: number) => n.toLocaleString("pt-BR");
  const out: string[] = [];
  if (!r.total) return out;
  out.push(`${f(r.pctResolvidos)}% dos atendimentos foram resolvidos (${r.resolvidos} de ${r.total}).`);
  if (r.especialidades.some((e) => e.nome !== "Outras especialidades")) {
    const top = r.especialidades.filter((e) => e.nome !== "Outras especialidades").slice(0, 2).map((e) => `${e.nome} (${e.qtd})`).join(" e ");
    out.push(`As especialidades mais procuradas foram ${top}, de ${r.totalConsultas} consultas.`);
  } else if (r.motivos[0]) out.push(`O motivo mais frequente foi "${r.motivos[0].nome}" (${r.motivos[0].qtd}).`);
  if (r.app) out.push(`${f(r.pctApp)}% dos atendimentos foram dúvidas sobre o app Samel (${r.app}).`);
  if (r.pico) out.push(`O horário de maior movimento foi das ${r.pico.inicio}h às ${r.pico.fim}h, com ${r.pico.qtd} atendimentos.`);
  if (ant && ant.total) {
    const v = variacao(r.total, ant.total)!;
    out.push(v === 0 ? "O volume de atendimentos ficou igual ao período anterior." : `O volume de atendimentos ${v > 0 ? "subiu" : "caiu"} ${f(Math.abs(v))}% em relação ao período anterior.`);
  }
  if (r.abertos) out.push(`Há ${r.abertos} atendimento(s) em aberto que pedem acompanhamento.`);
  return out.slice(0, 5);
}

export function nomeArquivo(empresa: string, de: string, ate: string) {
  const e = (empresa || "Todas").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "");
  return `Relatorio_Atendimentos_${e}_${de}_a_${ate}`;
}
