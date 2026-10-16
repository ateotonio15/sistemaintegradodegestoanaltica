import { supabase } from "@/integrations/supabase/client";
import {
  calcularStatusFinanceiro,
  calcularPrazoFinanceiro,
  expandirAnexosPorGrupo,
  fetchEmpresaGrupoMap,
  type StatusFinanceiro,
  type PrazoCategoria,
} from "@/lib/financeiro-utils";

/** Filtros do relatório analítico de faturamento. */
export interface RelatorioAnaliseFiltros {
  /** Competências (mes_referencia) — ex.: ["2026-08"] */
  competencias: string[];
  /** Dias de emissão selecionados; 0 = "sem dia definido". Vazio = todos. */
  diasEmissao: number[];
  /** Tipos de movimentação da empresa (Diária, Fechada...). Vazio = todos. */
  tiposMovimentacao: string[];
  /** Períodos de corte (01-05, 05-10...). Vazio = todos. */
  periodos: string[];
  /** Status financeiro calculado. Vazio = todos. */
  status: StatusFinanceiro[];
  /** Responsáveis / quem iniciou o faturamento. Vazio = todos. */
  responsaveis: string[];
  incluirValores: boolean;
  incluirDetalhamento: boolean;
  incluirFaltantes: boolean;
}

export interface LinhaRelatorio {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  empresa_codigo: string | null;
  vidas: number;
  competencia: string;
  periodo: string;
  dia_emissao: number | null;
  tipo_movimentacao: string | null;
  tipo_lancamento: string | null;
  status: StatusFinanceiro;
  aguardando_nota_em: string | null;
  faturamento_iniciado_em: string | null;
  faturamento_iniciado_por_nome: string | null;
  responsavel: string | null;
  data_envio_nota: string | null;
  data_vencimento: string | null;
  anexos_count: number;
  valor: number;
  grupo_id: string | null;
  prazo: PrazoCategoria;
}

export interface DadosRelatorio {
  linhas: LinhaRelatorio[];
  filtros: RelatorioAnaliseFiltros;
  /** Total de contratos antes dos filtros de status/dia/tipo/período. */
  totalBase: number;
}

const CHUNK = 300;

function chunk<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Busca paginada (contorna o limite de 1.000 linhas do PostgREST). */
async function fetchAll<T = any>(
  build: (from: number, to: number) => any,
): Promise<T[]> {
  const page = 1000;
  let from = 0;
  const all: T[] = [];
  for (;;) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < page) break;
    from += page;
  }
  return all;
}

const num = (v: any) => (typeof v === "number" && !isNaN(v) ? v : 0);

const presente = (v: any) => typeof v === "number" && !isNaN(v);

/**
 * Soma da análise de um pagador (base Excel, com fallback no PDF).
 * O Excel é a fonte quando foi lido — mesmo que o total seja zero (zero
 * válido ≠ ausência). O PDF só é usado quando NÃO há nenhum valor de Excel
 * gravado; nunca substitui silenciosamente um Excel que totaliza zero.
 */
export function valorAnalise(a: any): number {
  const camposExcel = [
    a.valor_excel_apartamento,
    a.valor_excel_enfermaria,
    a.valor_excel_inclusoes,
    a.valor_excel_exclusoes,
  ];
  if (camposExcel.some(presente)) {
    return camposExcel.reduce((s, v) => s + num(v), 0);
  }
  return (
    num(a.valor_pdf_apartamento) +
    num(a.valor_pdf_enfermaria) +
    num(a.valor_pdf_inclusoes) +
    num(a.valor_pdf_exclusoes)
  );
}

/**
 * Monta o dataset do relatório analítico direto do backend, replicando
 * as regras da aba Faturamento (empresa ativa/faturável, status calculado,
 * anexos compartilhados por Grupo Financeiro e valores das análises).
 */
export async function carregarDadosRelatorioAnalise(
  filtros: RelatorioAnaliseFiltros,
): Promise<DadosRelatorio> {
  const comps = filtros.competencias.filter(Boolean);
  if (comps.length === 0) return { linhas: [], filtros, totalBase: 0 };

  // 1) Movimentações financeiras das competências
  const movs = await fetchAll<any>((from, to) =>
    supabase
      .from("financeiro_movimentacoes")
      .select(
        "id, empresa_id, mes_referencia, periodo, dia_emissao, tipo_lancamento, data_envio_nota, data_vencimento, dentro_prazo, aguardando_nota_em, faturamento_iniciado_em, faturamento_iniciado_por_nome, responsavel",
      )
      .in("mes_referencia", comps)
      .order("id")
      .range(from, to),
  );

  if (movs.length === 0) return { linhas: [], filtros, totalBase: 0 };

  const empresaIds = Array.from(new Set(movs.map((m) => m.empresa_id)));

  // 2) Empresas
  const empresas: any[] = [];
  for (const ids of chunk(empresaIds)) {
    const { data, error } = await supabase
      .from("empresas")
      .select(
        "id, nome, codigo_contrato, tipo_movimentacao, status_empresa, data_rescisao, contrato_suspenso, vidas, nao_faturado_financeiro, exige_po_pc, aguarda_faturamento_excel",
      )
      .in("id", ids);
    if (error) throw error;
    empresas.push(...(data || []));
  }
  const empMap = new Map<string, any>(empresas.map((e) => [e.id, e]));

  // 3) Anexos financeiros (com compartilhamento por grupo)
  const movIds = movs.map((m) => m.id);
  const anexos: any[] = [];
  for (const ids of chunk(movIds)) {
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("anexos_financeiro")
        .select("financeiro_movimentacao_id, mime_type, nome_arquivo, origem")
        .in("financeiro_movimentacao_id", ids)
        .order("financeiro_movimentacao_id")
        .range(from, to),
    );
    anexos.push(...rows);
  }
  const empresaGrupo = await fetchEmpresaGrupoMap(supabase as any);
  const anexosPorMov = expandirAnexosPorGrupo(
    movs.map((m) => ({
      id: m.id,
      empresa_id: m.empresa_id,
      mes_referencia: m.mes_referencia,
      periodo: m.periodo,
    })),
    anexos,
    empresaGrupo,
  );

  // 4) Envio operacional (aba Movimentações)
  const envioMap = new Set<string>();
  for (const ids of chunk(empresaIds)) {
    const rows = await fetchAll<any>((from, to) =>
      supabase
        .from("movimentacoes")
        .select("empresa_id, periodo, mes_referencia, data_envio_financeiro")
        .in("mes_referencia", comps)
        .in("empresa_id", ids)
        .order("empresa_id")
        .range(from, to),
    );
    rows.forEach((m) => {
      if (m.data_envio_financeiro)
        envioMap.add(`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`);
    });
  }

  // 5) Valores das análises (por competência + chave de grupo)
  const valorPorChave = new Map<string, number>();
  if (filtros.incluirValores) {
    const analises = await fetchAll<any>((from, to) =>
      supabase
        .from("financeiro_analises")
        .select(
          "id, empresa_id, mes_referencia, valor_excel_apartamento, valor_excel_enfermaria, valor_excel_inclusoes, valor_excel_exclusoes, valor_pdf_apartamento, valor_pdf_enfermaria, valor_pdf_inclusoes, valor_pdf_exclusoes",
        )
        .in("mes_referencia", comps)
        .order("id")
        .range(from, to),
    );
    analises.forEach((a) => {
      const chave = `${a.mes_referencia}|${empresaGrupo.get(a.empresa_id) ?? a.empresa_id}`;
      valorPorChave.set(chave, (valorPorChave.get(chave) ?? 0) + valorAnalise(a));
    });
  }

  // 6) Montagem das linhas
  const usados = new Set<string>(); // chaves de grupo já creditadas (evita duplicar valor)
  const linhas: LinhaRelatorio[] = [];

  const ordenadas = [...movs].sort((a, b) => {
    const na = empMap.get(a.empresa_id)?.nome || "";
    const nb = empMap.get(b.empresa_id)?.nome || "";
    return na.localeCompare(nb, "pt-BR");
  });

  ordenadas.forEach((m) => {
    const emp = empMap.get(m.empresa_id);
    if (!emp) return;
    const ativa =
      (emp.status_empresa ?? "Ativa") === "Ativa" && !emp.data_rescisao && !emp.contrato_suspenso;
    if (!ativa || emp.nao_faturado_financeiro) return;

    const anexosMov = anexosPorMov.get(m.id) ?? [];
    const status = calcularStatusFinanceiro(
      m,
      envioMap.has(`${m.empresa_id}|${m.mes_referencia}|${m.periodo}`),
      anexosMov,
      !!emp.exige_po_pc,
      !!emp.aguarda_faturamento_excel,
    );

    const grupoId = empresaGrupo.get(m.empresa_id) ?? null;
    const chave = `${m.mes_referencia}|${grupoId ?? m.empresa_id}`;
    let valor = 0;
    if (filtros.incluirValores && !usados.has(chave)) {
      valor = valorPorChave.get(chave) ?? 0;
      if (valor) usados.add(chave);
    }

    linhas.push({
      id: m.id,
      empresa_id: m.empresa_id,
      empresa_nome: emp.nome,
      empresa_codigo: emp.codigo_contrato ?? null,
      vidas: emp.vidas ?? 0,
      competencia: m.mes_referencia,
      periodo: m.periodo,
      dia_emissao: m.dia_emissao ?? null,
      tipo_movimentacao: emp.tipo_movimentacao ?? null,
      tipo_lancamento: m.tipo_lancamento ?? null,
      status,
      aguardando_nota_em: m.aguardando_nota_em ?? null,
      faturamento_iniciado_em: m.faturamento_iniciado_em ?? null,
      faturamento_iniciado_por_nome: m.faturamento_iniciado_por_nome ?? null,
      responsavel: m.responsavel ?? null,
      data_envio_nota: m.data_envio_nota ?? null,
      data_vencimento: m.data_vencimento ?? null,
      anexos_count: anexosMov.length,
      valor,
      grupo_id: grupoId,
      prazo: calcularPrazoFinanceiro({
        aguardando_nota_em: m.aguardando_nota_em,
        data_envio_nota: m.data_envio_nota,
        dia_emissao: m.dia_emissao,
      }).categoria,
    });
  });

  const totalBase = linhas.length;

  const filtradas = linhas.filter((l) => {
    if (filtros.diasEmissao.length > 0 && !filtros.diasEmissao.includes(l.dia_emissao ?? 0))
      return false;
    if (
      filtros.tiposMovimentacao.length > 0 &&
      !filtros.tiposMovimentacao.includes(l.tipo_movimentacao || "—")
    )
      return false;
    if (filtros.periodos.length > 0 && !filtros.periodos.includes(l.periodo)) return false;
    if (filtros.status.length > 0 && !filtros.status.includes(l.status)) return false;
    if (filtros.responsaveis.length > 0) {
      const resp = l.faturamento_iniciado_por_nome || l.responsavel || "—";
      if (!filtros.responsaveis.includes(resp)) return false;
    }
    return true;
  });

  return { linhas: filtradas, filtros, totalBase };
}

/** Opções disponíveis (dias, tipos, períodos, responsáveis) para as competências. */
export async function carregarOpcoesRelatorio(competencias: string[]) {
  const comps = competencias.filter(Boolean);
  const vazio = { dias: [] as number[], tipos: [] as string[], periodos: [] as string[], responsaveis: [] as string[] };
  if (comps.length === 0) return vazio;

  const movs = await fetchAll<any>((from, to) =>
    supabase
      .from("financeiro_movimentacoes")
      .select("empresa_id, periodo, dia_emissao, faturamento_iniciado_por_nome, responsavel")
      .in("mes_referencia", comps)
      .order("empresa_id")
      .range(from, to),
  );
  if (movs.length === 0) return vazio;

  const empresaIds = Array.from(new Set(movs.map((m) => m.empresa_id)));
  const tipos = new Set<string>();
  for (const ids of chunk(empresaIds)) {
    const { data } = await supabase.from("empresas").select("tipo_movimentacao").in("id", ids);
    (data || []).forEach((e: any) => tipos.add(e.tipo_movimentacao || "—"));
  }

  const dias = new Set<number>();
  const periodos = new Set<string>();
  const responsaveis = new Set<string>();
  movs.forEach((m) => {
    dias.add(m.dia_emissao ?? 0);
    if (m.periodo) periodos.add(m.periodo);
    const r = m.faturamento_iniciado_por_nome || m.responsavel;
    if (r) responsaveis.add(r);
  });

  return {
    dias: Array.from(dias).sort((a, b) => a - b),
    tipos: Array.from(tipos).sort(),
    periodos: Array.from(periodos).sort(),
    responsaveis: Array.from(responsaveis).sort((a, b) => a.localeCompare(b, "pt-BR")),
  };
}
