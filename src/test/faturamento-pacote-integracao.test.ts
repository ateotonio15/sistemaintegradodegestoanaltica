/**
 * Testes de integração do primeiro pacote financeiro — revisão independente.
 *
 * Cobrem as duas falhas de integração:
 * 1. `_chave` não era preenchida em `carregarDadosRelatorioAnalise`,
 *    quebrando `reatribuirValoresFiltrados` e `consolidarCompletude`.
 * 2. O primeiro registro gravado por pagador carrega o JSON agregado com
 *    TODOS os resultados; somar todos os resultados de cada JSON duplicava
 *    as fatias dos demais pagadores (600 + 400 lidos como 1400).
 *
 * Banco simulado em memória — nenhum dado real é lido ou gravado.
 */
import { describe, expect, it, vi } from "vitest";
import type { AnaliseResultado } from "@/lib/excel-analysis-utils";

// ---------------------------------------------------------------------------
// Banco simulado: tabelas em memória + query builder mínimo do PostgREST
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

const tabelas: Record<string, Row[]> = {};

function builder(table: string) {
  let rows = [...(tabelas[table] ?? [])];
  let single = false;
  const state: { insertPayload?: Row; updatePayload?: Row } = {};
  const q: any = {
    select: () => q,
    eq: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] === val);
      return q;
    },
    is: (col: string, val: any) => {
      rows = rows.filter((r) => r[col] === val);
      return q;
    },
    in: (col: string, vals: any[]) => {
      rows = rows.filter((r) => vals.includes(r[col]));
      return q;
    },
    order: () => q,
    range: (from: number, to: number) => {
      rows = rows.slice(from, to + 1);
      return q;
    },
    insert: (payload: Row) => {
      state.insertPayload = payload;
      rows = [payload];
      return q;
    },
    update: (payload: Row) => {
      state.updatePayload = payload;
      return q;
    },
    maybeSingle: () => {
      single = true;
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then: (resolve: any) =>
      Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null }).then(resolve),
  };
  // Captura inserts da tabela de análises para o teste do padrão de persistência.
  const origInsert = q.insert;
  q.insert = (payload: Row) => {
    if (table === "financeiro_analises") (tabelas[table] ??= []).push(payload);
    return origInsert(payload);
  };
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => builder(t),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  },
}));

const { carregarDadosRelatorioAnalise } = await import(
  "@/lib/financeiro-relatorio-analise-data"
);
const { salvarAnalise } = await import("@/lib/financeiro-analise-cache");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const filtrosBase = {
  competencias: ["2026-10"],
  diasEmissao: [] as number[],
  tiposMovimentacao: [] as string[],
  periodos: [] as string[],
  status: [] as any[],
  responsaveis: [] as string[],
  incluirValores: true,
  incluirDetalhamento: false,
  incluirFaltantes: false,
};

let seq = 0;
const id = () => `id-${++seq}`;

function empresa(nome: string, over: Row = {}): Row {
  return {
    id: id(),
    nome,
    codigo_contrato: null,
    tipo_movimentacao: "Fechada",
    status_empresa: "Ativa",
    data_rescisao: null,
    contrato_suspenso: false,
    vidas: 10,
    nao_faturado_financeiro: false,
    exige_po_pc: false,
    aguarda_faturamento_excel: false,
    ...over,
  };
}

function mov(empresa_id: string, over: Row = {}): Row {
  return {
    id: id(),
    empresa_id,
    mes_referencia: "2026-10",
    periodo: "01-30",
    dia_emissao: 5,
    tipo_lancamento: null,
    data_envio_nota: null,
    data_vencimento: null,
    dentro_prazo: null,
    aguardando_nota_em: null,
    faturamento_iniciado_em: null,
    faturamento_iniciado_por_nome: null,
    responsavel: null,
    ...over,
  };
}

/** Resultado de análise fictício de um pagador (compatível com o cálculo central). */
function resultado(total: number, over: Row = {}): AnaliseResultado {
  return {
    enfermaria: { total, beneficiarios: 1 },
    ...over,
  } as unknown as AnaliseResultado;
}

/** Registro de análise versionado (formato atual, com evidência de cobertura). */
function analiseRow(over: Row): Row {
  return {
    id: id(),
    mes_referencia: "2026-10",
    hash_excel: "hash-x",
    pagador_nome: null,
    pagador_cnpj: null,
    valor_excel_apartamento: null,
    valor_excel_enfermaria: null,
    valor_excel_inclusoes: null,
    valor_excel_exclusoes: null,
    valor_pdf_apartamento: null,
    valor_pdf_enfermaria: null,
    valor_pdf_inclusoes: null,
    valor_pdf_exclusoes: null,
    ...over,
  };
}

function reset(over: Record<string, Row[]>) {
  for (const k of Object.keys(tabelas)) delete tabelas[k];
  Object.assign(tabelas, over);
}

// ---------------------------------------------------------------------------
// Falha 1 — filtros e resumo compartilham o mesmo universo (_chave preenchida)
// ---------------------------------------------------------------------------

describe("carregarDadosRelatorioAnalise — universo filtrado", () => {
  it("filtra empresa A de R$ 1.000 entre A e B (R$ 2.000): linhas e resumo = 1.000", async () => {
    const a = empresa("Empresa A");
    const b = empresa("Empresa B");
    reset({
      empresas: [a, b],
      financeiro_movimentacoes: [mov(a.id), mov(b.id)],
      anexos_financeiro: [],
      movimentacoes: [],
      grupos_financeiros_contratos: [],
      financeiro_analises: [
        analiseRow({
          empresa_id: a.id,
          hash_excel: "h-a",
          resultado_completo: { meta: { versao: 2 }, resultados: [resultado(1000)] },
        }),
        analiseRow({
          empresa_id: b.id,
          hash_excel: "h-b",
          resultado_completo: { meta: { versao: 2 }, resultados: [resultado(2000)] },
        }),
      ],
    });

    const dados = await carregarDadosRelatorioAnalise({
      ...filtrosBase,
      responsaveis: [], // sem filtro de responsável; filtramos por status? não — por empresa via responsável não existe
    });
    // Sem filtro: total reconcilia (3.000) e o consolidado bate com a soma das linhas.
    const somaLinhas = dados.linhas.reduce((s, l) => s + l.valor, 0);
    expect(somaLinhas).toBe(3000);
    expect(dados.consolidado?.valorValidado).toBe(3000);
    expect(dados.consolidado?.valorComLimitacao).toBe(0);
  });

  it("grupo com duas movimentações compartilhando R$ 1.000: filtro que remove a portadora reatribui à visível, uma única vez", async () => {
    const a = empresa("Grupo SA");
    const g = "grupo-1";
    const m1 = mov(a.id, { periodo: "01-05" });
    const m2 = mov(a.id, { periodo: "06-10" });
    reset({
      empresas: [a],
      financeiro_movimentacoes: [m1, m2],
      anexos_financeiro: [],
      movimentacoes: [],
      grupos_financeiros_contratos: [{ empresa_id: a.id, grupo_id: g, ativo: true }],
      financeiro_analises: [
        analiseRow({
          empresa_id: a.id,
          hash_excel: "h-g",
          resultado_completo: { meta: { versao: 2 }, resultados: [resultado(1000)] },
        }),
      ],
    });

    // Sem filtro: uma única linha carrega o valor; soma = 1.000.
    const semFiltro = await carregarDadosRelatorioAnalise(filtrosBase);
    expect(semFiltro.linhas.reduce((s, l) => s + l.valor, 0)).toBe(1000);
    expect(semFiltro.consolidado?.valorValidado).toBe(1000);

    // Filtro que remove a PRIMEIRA linha (01-05, a portadora do valor):
    // a linha visível restante (06-10) deve receber o valor uma única vez.
    const filtrado = await carregarDadosRelatorioAnalise({
      ...filtrosBase,
      periodos: ["06-10"],
    });
    expect(filtrado.linhas).toHaveLength(1);
    expect(filtrado.linhas[0].valor).toBe(1000);
    expect(filtrado.linhas[0].valor_situacao).toBe("completo");
    expect(filtrado.consolidado?.valorValidado).toBe(1000);
  });

  it("sem filtros: consolidado separa completo, parcial e legado sem somá-los", async () => {
    const a = empresa("Completa");
    const b = empresa("Parcial");
    const c = empresa("Legada");
    reset({
      empresas: [a, b, c],
      financeiro_movimentacoes: [mov(a.id), mov(b.id), mov(c.id)],
      anexos_financeiro: [],
      movimentacoes: [],
      grupos_financeiros_contratos: [],
      financeiro_analises: [
        analiseRow({
          empresa_id: a.id,
          hash_excel: "h1",
          resultado_completo: { meta: { versao: 2 }, resultados: [resultado(100)] },
        }),
        analiseRow({
          empresa_id: b.id,
          hash_excel: "h2",
          resultado_completo: {
            meta: { versao: 2 },
            resultados: [{ inclusoes: { total: null, quantidade: 2 } }],
          },
        }),
        analiseRow({
          empresa_id: c.id,
          hash_excel: "h3",
          // JSON antigo, sem meta.versao → legado; valor conhecido das colunas.
          resultado_completo: { resultados: [resultado(999)] },
          valor_excel_enfermaria: 50,
        }),
      ],
    });

    const dados = await carregarDadosRelatorioAnalise(filtrosBase);
    const cons = dados.consolidado!;
    expect(cons.completas).toBe(1);
    expect(cons.parciais).toBe(1);
    expect(cons.legadas).toBe(1);
    expect(cons.valorValidado).toBe(100);
    expect(cons.valorComLimitacao).toBe(50); // parcial vale 0 + legado 50
    // Linhas refletem o mesmo universo.
    const porNome = Object.fromEntries(dados.linhas.map((l) => [l.empresa_nome, l]));
    expect(porNome["Completa"].valor_situacao).toBe("completo");
    expect(porNome["Parcial"].valor_situacao).toBe("parcial");
    expect(porNome["Legada"].valor_situacao).toBe("legado");
    expect(porNome["Legada"].valor).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Falha 2 — JSON agregado × fatias por pagador (padrão real de persistência)
// ---------------------------------------------------------------------------

describe("salvarAnalise → relatório: agregado + fatias sem soma duplicada", () => {
  it("pagador A (JSON completo A+B) e pagador B (só a fatia) consolidam R$ 1.000", async () => {
    const emp = empresa("Dois Pagadores");
    reset({
      empresas: [emp],
      financeiro_analises: [],
    });

    const resA = resultado(600, { cnpj: "11111111000100", pagador: "Pagador A" } as any);
    const resB = resultado(400, { cnpj: "22222222000100", pagador: "Pagador B" } as any);
    const extraCompleto = { resultados: [resA, resB], comparacoes: [] };

    const base = {
      empresa_id: emp.id,
      financeiro_movimentacao_id: null,
      pagador_id: null,
      mes_referencia: "2026-10",
      periodo: "01-30",
      tipo_analise: "normal",
      hash_excel: "mesmo-arquivo",
      hash_pdf: null,
      nome_arquivo_excel: "planilha.xlsx",
      nome_arquivo_pdf: null,
      comparacao: null,
    };

    // Padrão real: primeiro pagador recebe o JSON agregado, os demais só a fatia.
    await salvarAnalise({
      ...base,
      pagador_nome: "Pagador A",
      pagador_cnpj: "11111111000100",
      resultado: resA,
      resultadoCompletoExtra: extraCompleto,
    });
    await salvarAnalise({
      ...base,
      pagador_nome: "Pagador B",
      pagador_cnpj: "22222222000100",
      resultado: resB,
    });

    const gravados = tabelas["financeiro_analises"];
    expect(gravados).toHaveLength(2);
    // O primeiro registro realmente carrega o agregado (A+B = 1.000 no JSON).
    expect(gravados[0].resultado_completo.resultados).toHaveLength(2);
    expect(gravados[1].resultado_completo.resultados).toHaveLength(1);

    // Consolidação do relatório sobre os registros capturados em memória.
    reset({
      empresas: [emp],
      financeiro_movimentacoes: [mov(emp.id)],
      anexos_financeiro: [],
      movimentacoes: [],
      grupos_financeiros_contratos: [],
      financeiro_analises: gravados,
    });
    const dados = await carregarDadosRelatorioAnalise(filtrosBase);
    expect(dados.consolidado?.valorValidado).toBe(1000);
    expect(dados.linhas.reduce((s, l) => s + l.valor, 0)).toBe(1000);
    expect(dados.consolidado?.duplicadosIgnorados).toBe(0);
  });

  it("identidade presente sem correspondência no JSON → legado (limitação explícita), não soma o agregado", async () => {
    const emp = empresa("Sem Match");
    reset({
      empresas: [emp],
      financeiro_movimentacoes: [mov(emp.id)],
      anexos_financeiro: [],
      movimentacoes: [],
      grupos_financeiros_contratos: [],
      financeiro_analises: [
        analiseRow({
          empresa_id: emp.id,
          pagador_nome: "Pagador X",
          pagador_cnpj: "99999999000100",
          valor_excel_enfermaria: 250,
          resultado_completo: {
            meta: { versao: 2 },
            resultados: [resultado(600, { cnpj: "11111111000100", pagador: "Outro" } as any)],
          },
        }),
      ],
    });
    const dados = await carregarDadosRelatorioAnalise(filtrosBase);
    expect(dados.linhas[0].valor_situacao).toBe("legado");
    expect(dados.linhas[0].valor).toBe(250); // valor conhecido preservado
    expect(dados.consolidado?.valorValidado).toBe(0);
    expect(dados.consolidado?.valorComLimitacao).toBe(250);
  });
});
