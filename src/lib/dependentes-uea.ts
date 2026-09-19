// Regras do módulo Dependentes UEA (independente dos demais módulos).
// As faixas etárias e seus valores são SEMPRE lidos da configuração (uea_faixas),
// nunca fixados em código.

export type DependenteStatus = "ativo" | "desligado";

export type StatusMargem =
  | "Sem dependentes"
  | "Com margem"
  | "Margem comprometida"
  | "Sem margem";

export interface FaixaUea {
  id: string;
  idade_inicial: number;
  idade_final: number | null;
  valor_mensal: number;
  vigencia_inicio: string;
  vigencia_fim: string | null;
  observacao: string | null;
  /** Capa da tabela à qual a faixa pertence (ex.: "Tabela UEA - 1 (01/10/2025)"). */
  tabela_nome: string | null;
  /** Plano da capa (ex.: "Quality Plus - Apartamento"). */
  plano: string | null;
  /** Nº de sequência informado na capa. */
  sequencia: string | null;
}

/** Capa de tabela de faixas (agrupamento visual das faixas). */
export interface FaixaTabelaCapa {
  chave: string;
  descricao: string;
  plano: string | null;
  sequencia: string | null;
  vigencia_inicio: string;
  faixas: FaixaUea[];
}

/** Agrupa as faixas em capas por descrição + plano + início de vigência. */
export function agruparFaixasEmCapas(faixas: FaixaUea[]): FaixaTabelaCapa[] {
  const mapa = new Map<string, FaixaTabelaCapa>();
  for (const f of faixas) {
    const descricao = f.tabela_nome?.trim() || "Tabela UEA";
    const plano = f.plano?.trim() || null;
    const vig = f.vigencia_inicio.slice(0, 10);
    const chave = `${descricao}::${plano ?? ""}::${vig}`;
    const capa =
      mapa.get(chave) ?? { chave, descricao, plano, sequencia: null, vigencia_inicio: vig, faixas: [] };
    capa.sequencia = capa.sequencia ?? (f.sequencia?.trim() || null);
    capa.faixas.push(f);
    mapa.set(chave, capa);
  }
  const capas = [...mapa.values()];
  for (const c of capas) c.faixas.sort((a, b) => a.idade_inicial - b.idade_inicial);
  capas.sort((a, b) => b.vigencia_inicio.localeCompare(a.vigencia_inicio));
  return capas;
}

export interface DependenteUea {
  id: string;
  titular_id: string;
  nome_completo: string;
  cpf: string | null;
  carteirinha: string | null;
  data_nascimento: string | null;
  parentesco: string | null;
  situacao: string | null;
  plano: string | null;
  faixa_sequencia: string | null;
  faixa_etaria: string | null;
  valor_mensal: number;
  cobranca_validada?: boolean;
  cobranca_validada_em?: string | null;
  cobranca_validada_por?: string | null;
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
  carteirinha: string | null;
  matricula: string | null;
  contrato: string | null;
  data_nascimento: string | null;
  situacao: string | null;
  plano: string | null;
  faixa_sequencia: string | null;
  valor_margem: number;
  cobranca_validada?: boolean;
  cobranca_validada_em?: string | null;
  cobranca_validada_por?: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  dependentes: DependenteUea[];
}

export interface DependenteCalculado extends DependenteUea {
  idade_atual: number | null;
  faixa_atual: FaixaUea | null;
  faixa_atual_label: string;
  /** Valor da faixa configurada; se não houver configuração aplicável, usa o valor cadastrado. */
  valor_aplicavel: number;
  /** Diferença entre o valor cadastrado e o valor da faixa configurada. */
  valor_desatualizado: boolean;
  proxima_faixa: FaixaUea | null;
  proxima_faixa_label: string | null;
  data_proxima_mudanca: string | null;
  dias_proxima_mudanca: number | null;
  proximo_valor: number | null;
  /** Data (ISO) em que o dependente entrou na faixa atual (aniversário do corte). */
  data_ultima_mudanca_faixa: string | null;
  desligado_por_falta_de_margem: boolean;
  status_label: string;
}

export interface TitularCalculado extends TitularUea {
  dependentes_calculados: DependenteCalculado[];
  quantidade_dependentes: number;
  quantidade_dependentes_ativos: number;
  quantidade_dependentes_desligados: number;
  valor_total_dependentes_ativos: number;
  margem_restante: number;
  status_margem: StatusMargem;
  /** Quanto os dependentes ativos ultrapassam a margem (0 quando não ultrapassa). */
  excedente_margem: number;
  /** Total dos ativos considerando o valor da faixa vigente (valor a aplicar). */
  valor_total_aplicavel: number;
  margem_restante_projetada: number;
  /** Mudança de faixa etária faria o titular ultrapassar a margem — requer análise humana. */
  requer_analise_faixa: boolean;
  /** Status exibido: inclui "Sem margem — requer análise" na mudança de faixa. */
  status_exibicao: string;
  desligado_por_falta_de_margem: boolean;
  proxima_mudanca_faixa: { dependente: string; data: string; dias: number; label: string } | null;
  ultima_atualizacao: string;
}

/** Lê um valor em reais digitado no formato brasileiro (1.234,56) ou simples (1234.56). */
export function parseValorBr(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return Number.isFinite(texto) ? texto : 0;
  let s = String(texto ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!s) return 0;
  const temVirgula = s.includes(",");
  if (temVirgula) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // Ponto usado como separador de milhar (1.234 / 1.234.567)
    const partes = s.split(".");
    if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) s = partes.join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Constrói a data local sem deslocamento de fuso (padrão do sistema). */
export function parseISODateLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
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

export function faixaLabel(f: FaixaUea): string {
  return f.idade_final === null
    ? `${f.idade_inicial} ou mais`
    : `${f.idade_inicial} a ${f.idade_final}`;
}

/** Faixas em vigência na data de referência, ordenadas por idade inicial. */
export function faixasVigentes(faixas: FaixaUea[], ref = new Date()): FaixaUea[] {
  const iso = toISODateLocal(ref);
  return faixas
    .filter(
      (f) =>
        (!f.vigencia_inicio || f.vigencia_inicio.slice(0, 10) <= iso) &&
        (!f.vigencia_fim || f.vigencia_fim.slice(0, 10) >= iso),
    )
    .sort((a, b) => a.idade_inicial - b.idade_inicial);
}

export function faixaParaIdade(faixas: FaixaUea[], idade: number, ref = new Date()): FaixaUea | null {
  return (
    faixasVigentes(faixas, ref).find(
      (f) => idade >= f.idade_inicial && (f.idade_final === null || idade <= f.idade_final),
    ) ?? null
  );
}

function normalizarPlano(plano: string | null | undefined): string {
  return String(plano ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*-\s*protocolo.*$/i, "")
    .trim()
    .toLowerCase();
}

/** Escolhe uma única tabela para evitar misturar planos ou vigências sobrepostas. */
export function faixaAplicavelDependente(
  faixas: FaixaUea[],
  dep: Pick<DependenteUea, "plano" | "faixa_sequencia" | "valor_mensal">,
  idade: number,
  ref = new Date(),
): FaixaUea | null {
  const candidatas = faixasVigentes(faixas, ref).filter(
    (f) => idade >= f.idade_inicial && (f.idade_final === null || idade <= f.idade_final),
  );
  if (candidatas.length === 0) return null;

  let filtradas = dep.faixa_sequencia
    ? candidatas.filter((f) => f.sequencia === dep.faixa_sequencia)
    : candidatas;
  const plano = normalizarPlano(dep.plano);
  if (!dep.faixa_sequencia && plano) {
    const mesmoPlano = filtradas.filter((f) => normalizarPlano(f.plano) === plano);
    if (mesmoPlano.length > 0) filtradas = mesmoPlano;
  }
  if (!dep.faixa_sequencia) {
    const mesmoValor = filtradas.filter(
      (f) => Number(f.valor_mensal).toFixed(2) === Number(dep.valor_mensal || 0).toFixed(2),
    );
    if (mesmoValor.length > 0) filtradas = mesmoValor;
  }
  return [...filtradas].sort((a, b) => b.vigencia_inicio.localeCompare(a.vigencia_inicio))[0] ?? null;
}

export const DIAS_PROXIMA_FAIXA = 90;

export function calcularDependente(
  dep: DependenteUea,
  faixas: FaixaUea[],
  ref = new Date(),
): DependenteCalculado {
  const idade = dep.data_nascimento ? idadeEm(dep.data_nascimento, ref) : null;
  const vigentes = faixasVigentes(faixas, ref);
  const faixaAtual = idade === null ? null : faixaAplicavelDependente(faixas, dep, idade, ref);
  const faixasDaTabela = faixaAtual
    ? vigentes.filter((f) =>
        faixaAtual.sequencia
          ? f.sequencia === faixaAtual.sequencia
          : f.tabela_nome === faixaAtual.tabela_nome && f.plano === faixaAtual.plano,
      )
    : [];
  const valorAplicavel = faixaAtual ? Number(faixaAtual.valor_mensal) : Number(dep.valor_mensal || 0);

  let proxima: FaixaUea | null = null;
  let dataProxima: string | null = null;
  let diasProxima: number | null = null;
  if (idade !== null && dep.data_nascimento) {
    proxima = faixasDaTabela.find((f) => f.idade_inicial > idade) ?? null;
    if (proxima) {
      const nasc = parseISODateLocal(dep.data_nascimento);
      const data = new Date(nasc.getFullYear() + proxima.idade_inicial, nasc.getMonth(), nasc.getDate());
      dataProxima = toISODateLocal(data);
      diasProxima = Math.ceil((data.getTime() - ref.getTime()) / 86_400_000);
    }
  }

  const porFaltaMargem =
    dep.status === "desligado" && /margem/i.test(dep.motivo_desligamento ?? "");

  // Data em que entrou na faixa atual: aniversário correspondente à idade inicial da faixa.
  let dataUltimaMudanca: string | null = null;
  if (faixaAtual && dep.data_nascimento) {
    const nasc = parseISODateLocal(dep.data_nascimento);
    const entrada = new Date(nasc.getFullYear() + faixaAtual.idade_inicial, nasc.getMonth(), nasc.getDate());
    const hojeIso = toISODateLocal(ref);
    const entradaIso = toISODateLocal(entrada);
    if (entradaIso <= hojeIso) dataUltimaMudanca = entradaIso;
  }

  return {
    ...dep,
    idade_atual: idade,
    faixa_atual: faixaAtual,
    faixa_atual_label: faixaAtual ? faixaLabel(faixaAtual) : dep.faixa_etaria || "—",
    valor_aplicavel: Number(valorAplicavel.toFixed(2)),
    valor_desatualizado:
      !!faixaAtual && Number(faixaAtual.valor_mensal).toFixed(2) !== Number(dep.valor_mensal || 0).toFixed(2),
    proxima_faixa: proxima,
    proxima_faixa_label: proxima ? faixaLabel(proxima) : null,
    data_proxima_mudanca: dataProxima,
    dias_proxima_mudanca: diasProxima,
    proximo_valor: proxima ? Number(Number(proxima.valor_mensal).toFixed(2)) : null,
    data_ultima_mudanca_faixa: dataUltimaMudanca,
    desligado_por_falta_de_margem: porFaltaMargem,
    status_label:
      dep.status === "ativo"
        ? "Ativo"
        : porFaltaMargem
        ? "Desligado por falta de margem"
        : "Desligado",
  };
}

export function statusMargem(ativos: number, margemRestante: number): StatusMargem {
  if (ativos === 0) return "Sem dependentes";
  if (margemRestante > 0) return "Com margem";
  if (margemRestante === 0) return "Margem comprometida";
  return "Sem margem";
}

export function calcularTitular(
  titular: TitularUea,
  faixas: FaixaUea[] = [],
  ref = new Date(),
): TitularCalculado {
  const deps = (titular.dependentes ?? []).map((d) => calcularDependente(d, faixas, ref));
  const ativos = deps.filter((d) => d.status === "ativo");
  const desligados = deps.filter((d) => d.status === "desligado");
  // Dependentes desligados NÃO entram no valor mensal atual.
  const valorAtivos = ativos.reduce((acc, d) => acc + Number(d.valor_mensal || 0), 0);
  const margem = Number(titular.valor_margem || 0);
  const restante = Number((margem - valorAtivos).toFixed(2));
  const valorAplicavel = Number(
    ativos.reduce((acc, d) => acc + Number(d.valor_aplicavel || 0), 0).toFixed(2),
  );
  const restanteProjetada = Number((margem - valorAplicavel).toFixed(2));
  const requerAnaliseFaixa =
    ativos.some((d) => d.valor_desatualizado) && restanteProjetada < 0;


  const proximas = ativos
    .filter((d) => d.data_proxima_mudanca && (d.dias_proxima_mudanca ?? -1) >= 0)
    .sort((a, b) => (a.dias_proxima_mudanca ?? 0) - (b.dias_proxima_mudanca ?? 0));
  const prox = proximas[0];

  return {
    ...titular,
    dependentes_calculados: deps,
    quantidade_dependentes: deps.length,
    quantidade_dependentes_ativos: ativos.length,
    quantidade_dependentes_desligados: desligados.length,
    valor_total_dependentes_ativos: Number(valorAtivos.toFixed(2)),
    margem_restante: restante,
    status_margem: statusMargem(ativos.length, restante),
    excedente_margem: restante < 0 ? Number(Math.abs(restante).toFixed(2)) : 0,
    valor_total_aplicavel: valorAplicavel,
    margem_restante_projetada: restanteProjetada,
    requer_analise_faixa: requerAnaliseFaixa,
    status_exibicao: requerAnaliseFaixa
      ? "Sem margem — requer análise"
      : statusMargem(ativos.length, restante),
    desligado_por_falta_de_margem: desligados.some((d) => d.desligado_por_falta_de_margem),
    proxima_mudanca_faixa: prox
      ? {
          dependente: prox.nome_completo,
          data: prox.data_proxima_mudanca as string,
          dias: prox.dias_proxima_mudanca as number,
          label: `${prox.faixa_atual_label} → ${prox.proxima_faixa_label}`,
        }
      : null,
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
  if (d.length !== 11) return v || "—";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatBRL(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return parseISODateLocal(iso).toLocaleDateString("pt-BR");
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

/* ------------------------- Controle de margem financeira ------------------------ */

export interface AnaliseReativacao {
  ok: boolean;
  disponivel: number;
  necessario: number;
  faltante: number;
}

/** Verifica se há margem suficiente para reativar um dependente desligado. */
export function analisarReativacao(
  titular: TitularCalculado,
  dependente: DependenteCalculado,
): AnaliseReativacao {
  const disponivel = Number(titular.margem_restante.toFixed(2));
  const necessario = Number(Number(dependente.valor_aplicavel || dependente.valor_mensal || 0).toFixed(2));
  const faltante = Number(Math.max(0, necessario - disponivel).toFixed(2));
  return { ok: faltante === 0, disponivel, necessario, faltante };
}

export const MOTIVO_FALTA_MARGEM = "Falta de margem";

/* --------------------- Próximas mudanças de faixa etária -------------------- */

export interface MudancaFaixaPrevista {
  dependente_id: string;
  dependente_nome: string;
  titular_id: string;
  titular_nome: string;
  data_nascimento: string | null;
  data_mudanca: string;
  dias: number;
  faixa_atual_label: string;
  proxima_faixa_label: string | null;
  valor_atual: number;
  novo_valor: number;
  diferenca: number;
  margem_atual: number;
  margem_apos: number;
  ficara_sem_margem: boolean;
}

/** Dependentes ativos que mudarão de valor dentro da janela informada (em dias). */
export function proximasMudancasFaixa(
  titulares: TitularCalculado[],
  dias = DIAS_PROXIMA_FAIXA,
): MudancaFaixaPrevista[] {
  const lista: MudancaFaixaPrevista[] = [];
  titulares.forEach((t) => {
    t.dependentes_calculados
      .filter(
        (d) =>
          d.status === "ativo" &&
          d.data_proxima_mudanca &&
          d.proximo_valor !== null &&
          (d.dias_proxima_mudanca ?? -1) >= 0 &&
          (d.dias_proxima_mudanca ?? 0) <= dias,
      )
      .forEach((d) => {
        const valorAtual = Number(d.valor_mensal || 0);
        const novoValor = Number(d.proximo_valor ?? 0);
        const diferenca = Number((novoValor - valorAtual).toFixed(2));
        const margemApos = Number((t.margem_restante - diferenca).toFixed(2));
        lista.push({
          dependente_id: d.id,
          dependente_nome: d.nome_completo,
          titular_id: t.id,
          titular_nome: t.nome_completo,
          data_nascimento: d.data_nascimento,
          data_mudanca: d.data_proxima_mudanca as string,
          dias: d.dias_proxima_mudanca as number,
          faixa_atual_label: d.faixa_atual_label,
          proxima_faixa_label: d.proxima_faixa_label,
          valor_atual: valorAtual,
          novo_valor: novoValor,
          diferenca,
          margem_atual: t.margem_restante,
          margem_apos: margemApos,
          ficara_sem_margem: margemApos < 0,
        });
      });
  });
  return lista.sort((a, b) => a.dias - b.dias);
}

export type FiltroMudanca = "30" | "60" | "90" | "sem_margem" | "com_margem";

export const FILTROS_MUDANCA: { value: FiltroMudanca; label: string }[] = [
  { value: "30", label: "Mudança nos próximos 30 dias" },
  { value: "60", label: "Mudança nos próximos 60 dias" },
  { value: "90", label: "Mudança nos próximos 90 dias" },
  { value: "sem_margem", label: "Ficará sem margem" },
  { value: "com_margem", label: "Com margem suficiente" },
];

export function aplicaFiltroMudanca(m: MudancaFaixaPrevista, filtro: FiltroMudanca): boolean {
  switch (filtro) {
    case "30":
      return m.dias <= 30;
    case "60":
      return m.dias <= 60;
    case "90":
      return m.dias <= 90;
    case "sem_margem":
      return m.ficara_sem_margem;
    case "com_margem":
      return !m.ficara_sem_margem;
    default:
      return true;
  }
}
