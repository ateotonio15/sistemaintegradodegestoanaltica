// Regras do módulo Dependentes UEA (independente dos demais módulos).

export type DependenteStatus = "ativo" | "desligado";

export type StatusMargem =
  | "Sem dependentes"
  | "Com margem"
  | "Margem comprometida"
  | "Sem margem";

export interface DependenteUea {
  id: string;
  titular_id: string;
  nome_completo: string;
  cpf: string | null;
  data_nascimento: string | null;
  parentesco: string | null;
  faixa_etaria: string | null;
  valor_mensal: number;
  status: DependenteStatus;
  motivo_desligamento: string | null;
  data_desligamento: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface TitularUea {
  id: string;
  nome_completo: string;
  cpf: string;
  matricula: string | null;
  contrato: string | null;
  valor_margem: number;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  dependentes: DependenteUea[];
}

export interface TitularCalculado extends TitularUea {
  quantidade_dependentes: number;
  quantidade_dependentes_ativos: number;
  quantidade_dependentes_desligados: number;
  valor_total_dependentes_ativos: number;
  margem_restante: number;
  status_margem: StatusMargem;
  desligado_por_falta_de_margem: boolean;
  proxima_mudanca_faixa: ProximaFaixa | null;
  ultima_atualizacao: string;
}

export interface ProximaFaixa {
  dependente: string;
  faixa_atual: string;
  proxima_faixa: string;
  data: string; // ISO
  dias: number;
}

// Faixas etárias padrão (ANS) — limites de idade inicial de cada faixa.
export const FAIXAS_ETARIAS: { label: string; min: number; max: number | null }[] = [
  { label: "0 a 18", min: 0, max: 18 },
  { label: "19 a 23", min: 19, max: 23 },
  { label: "24 a 28", min: 24, max: 28 },
  { label: "29 a 33", min: 29, max: 33 },
  { label: "34 a 38", min: 34, max: 38 },
  { label: "39 a 43", min: 39, max: 43 },
  { label: "44 a 48", min: 44, max: 48 },
  { label: "49 a 53", min: 49, max: 53 },
  { label: "54 a 58", min: 54, max: 58 },
  { label: "59 ou mais", min: 59, max: null },
];

/** Constrói a data local sem deslocamento de fuso (padrão do sistema). */
export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function idadeEm(nascimentoISO: string, ref = new Date()): number {
  const nasc = parseISODateLocal(nascimentoISO);
  let idade = ref.getFullYear() - nasc.getFullYear();
  const mes = ref.getMonth() - nasc.getMonth();
  if (mes < 0 || (mes === 0 && ref.getDate() < nasc.getDate())) idade -= 1;
  return idade;
}

export function faixaDaIdade(idade: number): string {
  const faixa = FAIXAS_ETARIAS.find((f) => idade >= f.min && (f.max === null || idade <= f.max));
  return faixa?.label ?? "—";
}

/** Próxima data em que o dependente muda de faixa etária. */
export function proximaMudancaFaixa(dep: DependenteUea, ref = new Date()): ProximaFaixa | null {
  if (!dep.data_nascimento || dep.status !== "ativo") return null;
  const idade = idadeEm(dep.data_nascimento, ref);
  const idxAtual = FAIXAS_ETARIAS.findIndex(
    (f) => idade >= f.min && (f.max === null || idade <= f.max),
  );
  if (idxAtual < 0 || idxAtual === FAIXAS_ETARIAS.length - 1) return null;
  const proxima = FAIXAS_ETARIAS[idxAtual + 1];
  const nasc = parseISODateLocal(dep.data_nascimento);
  const data = new Date(nasc.getFullYear() + proxima.min, nasc.getMonth(), nasc.getDate());
  const dias = Math.ceil((data.getTime() - ref.getTime()) / 86_400_000);
  if (dias < 0) return null;
  return {
    dependente: dep.nome_completo,
    faixa_atual: FAIXAS_ETARIAS[idxAtual].label,
    proxima_faixa: proxima.label,
    data: toISODateLocal(data),
    dias,
  };
}

export const DIAS_PROXIMA_FAIXA = 90;

export function statusMargem(ativos: number, margemRestante: number): StatusMargem {
  if (ativos === 0) return "Sem dependentes";
  if (margemRestante > 0) return "Com margem";
  if (margemRestante === 0) return "Margem comprometida";
  return "Sem margem";
}

const RE_FALTA_MARGEM = /(falta|sem)\s+de?\s*margem|margem/i;

export function calcularTitular(titular: TitularUea, ref = new Date()): TitularCalculado {
  const deps = titular.dependentes ?? [];
  const ativos = deps.filter((d) => d.status === "ativo");
  const desligados = deps.filter((d) => d.status === "desligado");
  const valorAtivos = ativos.reduce((acc, d) => acc + Number(d.valor_mensal || 0), 0);
  const margem = Number(titular.valor_margem || 0);
  const restante = Number((margem - valorAtivos).toFixed(2));

  const proximas = ativos
    .map((d) => proximaMudancaFaixa(d, ref))
    .filter((p): p is ProximaFaixa => !!p)
    .sort((a, b) => a.dias - b.dias);

  return {
    ...titular,
    quantidade_dependentes: deps.length,
    quantidade_dependentes_ativos: ativos.length,
    quantidade_dependentes_desligados: desligados.length,
    valor_total_dependentes_ativos: Number(valorAtivos.toFixed(2)),
    margem_restante: restante,
    status_margem: statusMargem(ativos.length, restante),
    desligado_por_falta_de_margem: desligados.some((d) =>
      RE_FALTA_MARGEM.test(d.motivo_desligamento ?? ""),
    ),
    proxima_mudanca_faixa: proximas[0] ?? null,
    ultima_atualizacao: [titular.updated_at, ...deps.map((d) => d.updated_at)]
      .filter(Boolean)
      .sort()
      .slice(-1)[0] as string,
  };
}

export type FiltroUea =
  | "todos"
  | "com_margem"
  | "sem_margem"
  | "margem_comprometida"
  | "possui_dependentes"
  | "sem_dependentes"
  | "desligado_falta_margem"
  | "proximos_faixa";

export const FILTROS_UEA: { value: FiltroUea; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "com_margem", label: "Com margem" },
  { value: "sem_margem", label: "Sem margem" },
  { value: "margem_comprometida", label: "Margem comprometida" },
  { value: "possui_dependentes", label: "Possui dependentes" },
  { value: "sem_dependentes", label: "Sem dependentes" },
  { value: "desligado_falta_margem", label: "Dependente desligado por falta de margem" },
  { value: "proximos_faixa", label: "Próximos de mudança de faixa etária" },
];

export function aplicaFiltro(t: TitularCalculado, filtro: FiltroUea): boolean {
  switch (filtro) {
    case "com_margem":
      return t.status_margem === "Com margem";
    case "sem_margem":
      return t.status_margem === "Sem margem";
    case "margem_comprometida":
      return t.status_margem === "Margem comprometida";
    case "possui_dependentes":
      return t.quantidade_dependentes_ativos > 0;
    case "sem_dependentes":
      return t.quantidade_dependentes_ativos === 0;
    case "desligado_falta_margem":
      return t.desligado_por_falta_de_margem;
    case "proximos_faixa":
      return !!t.proxima_mudanca_faixa && t.proxima_mudanca_faixa.dias <= DIAS_PROXIMA_FAIXA;
    default:
      return true;
  }
}

export function soDigitos(v: string): string {
  return String(v || "").replace(/\D/g, "");
}

export function formatCPF(v: string | null | undefined): string {
  const d = soDigitos(v ?? "");
  if (d.length !== 11) return v ?? "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISODateLocal(iso.slice(0, 10));
  return d.toLocaleDateString("pt-BR");
}

export function buscaTitular(t: TitularCalculado, termo: string): boolean {
  const q = termo.trim().toLowerCase();
  if (!q) return true;
  const digits = soDigitos(q);
  return (
    t.nome_completo.toLowerCase().includes(q) ||
    (t.matricula ?? "").toLowerCase().includes(q) ||
    (!!digits && soDigitos(t.cpf).includes(digits))
  );
}
