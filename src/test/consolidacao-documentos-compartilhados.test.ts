/**
 * Item 3 — Consolidação de documentos compartilhados.
 *
 * Cenário A: duas movimentações do mesmo grupo compartilham o mesmo anexo
 * de R$ 1.000 → o documento aparece nos dois contratos, mas o total
 * consolidado conta R$ 1.000 (não R$ 2.000) — na Previsão e no relatório.
 *
 * Cenário B (inverso): dois documentos legítimos distintos de R$ 1.000
 * para o mesmo pagador → total R$ 2.000.
 */
import { describe, expect, it } from "vitest";
import { somarTotalPrevisto, type ItemTotalPrevisto } from "../lib/previsao-total";
import { agregarValoresAnalises } from "../lib/financeiro-relatorio-analise-data";

const GRUPO = "grupo-1";

const item = (
  paths: string[],
  total: number,
  opts: Partial<ItemTotalPrevisto> = {},
): ItemTotalPrevisto => ({
  xlsPaths: paths,
  cnpjFiltro: null,
  semSeparacaoPorPagador: false,
  totalGeral: total,
  ...opts,
});

describe("Previsão Financeira — somarTotalPrevisto", () => {
  it("mesmo anexo compartilhado por duas movimentações do grupo conta uma vez", () => {
    const path = "financeiro/mov-origem/planilha.xlsx";
    const total = somarTotalPrevisto([
      item([path], 1000), // linha da movimentação A (dona do anexo)
      item([path], 1000), // linha da movimentação B (anexo compartilhado)
    ]);
    expect(total).toBe(1000);
  });

  it("dois documentos distintos de R$ 1.000 para o mesmo pagador somam R$ 2.000", () => {
    const total = somarTotalPrevisto([
      item(["financeiro/a/doc1.xlsx"], 1000),
      item(["financeiro/b/doc2.xlsx"], 1000),
    ]);
    expect(total).toBe(2000);
  });

  it("linha-mãe e linha de pagador da mesma movimentação não são deduplicadas entre si", () => {
    const path = "financeiro/mov/planilha.xlsx";
    const total = somarTotalPrevisto([
      item([path], 600, { cnpjFiltro: "111" }), // fatia da empresa
      item([path], 400, { cnpjFiltro: "222" }), // fatia do segundo pagador
    ]);
    expect(total).toBe(1000);
  });

  it("planilha sem separação por pagador conta o agregado uma única vez", () => {
    const path = "financeiro/mov/sem-pagador.xlsx";
    const total = somarTotalPrevisto([
      item([path], 1000, { semSeparacaoPorPagador: true, cnpjFiltro: "111" }),
      item([path], 1000, { semSeparacaoPorPagador: true, cnpjFiltro: "222" }),
    ]);
    expect(total).toBe(1000);
  });
});

const analise = (over: Record<string, unknown>) => ({
  empresa_id: "emp-a",
  mes_referencia: "2026-10",
  hash_excel: null,
  resultado_completo: null,
  valor_excel_apartamento: 0,
  valor_excel_enfermaria: 1000,
  valor_excel_inclusoes: 0,
  valor_excel_exclusoes: 0,
  valor_pdf_apartamento: null,
  valor_pdf_enfermaria: null,
  valor_pdf_inclusoes: null,
  valor_pdf_exclusoes: null,
  ...over,
});

describe("Relatório analítico — agregarValoresAnalises", () => {
  const grupo = new Map<string, string>([
    ["emp-a", GRUPO],
    ["emp-b", GRUPO],
  ]);

  it("mesmo arquivo (hash) analisado em dois registros do grupo conta uma vez", () => {
    const { porChave, duplicadosIgnorados } = agregarValoresAnalises(
      [
        analise({ empresa_id: "emp-a", hash_excel: "hash-1" }),
        analise({ empresa_id: "emp-b", hash_excel: "hash-1" }),
      ],
      grupo,
    );
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(1000);
    expect(duplicadosIgnorados).toBe(1);
  });

  it("dois documentos distintos (hashes diferentes) do mesmo pagador somam R$ 2.000", () => {
    const { porChave, duplicadosIgnorados } = agregarValoresAnalises(
      [analise({ hash_excel: "hash-1" }), analise({ hash_excel: "hash-2" })],
      grupo,
    );
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(2000);
    expect(duplicadosIgnorados).toBe(0);
  });

  it("registros sem hash contam individualmente (limite documentado)", () => {
    const { porChave } = agregarValoresAnalises([analise({}), analise({})], grupo);
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(2000);
  });

  it("resultado_completo compatível usa o cálculo centralizado e marca completo", () => {
    const rc = {
      resultados: [
        {
          pagador: "P1",
          enfermaria: { beneficiarios: 10, mensalidade: 80, total: 800 },
          apartamento: { beneficiarios: 0, mensalidade: 0, total: 0 },
          inclusoes: { quantidade: 2, total: 300 },
          retroativas: { quantidade: 1, total: 100 }, // subconjunto: nunca soma
          exclusoes: { quantidade: 1, total: -100 },
        },
      ],
      comparacoes: [],
    };
    const { porChave } = agregarValoresAnalises(
      [analise({ resultado_completo: rc, hash_excel: "h" })],
      grupo,
    );
    const agreg = porChave.get(`2026-10|${GRUPO}`);
    expect(agreg?.valor).toBe(1000); // 800 + 300 − 100; retroativos fora
    expect(agreg?.situacao).toBe("completo");
  });

  it("JSON sem categorias numéricas cai no valor conhecido com selo legado", () => {
    const { porChave } = agregarValoresAnalises(
      [analise({ resultado_completo: { resultados: [{ pagador: "P1" }], comparacoes: [] } })],
      grupo,
    );
    const agreg = porChave.get(`2026-10|${GRUPO}`);
    expect(agreg?.valor).toBe(1000); // valor das colunas escalares preservado
    expect(agreg?.situacao).toBe("legado");
  });

  it("categoria com quantidade e valor ausente marca a chave como parcial", () => {
    const rc = {
      resultados: [
        {
          pagador: "P1",
          enfermaria: { beneficiarios: 10, mensalidade: 100, total: 1000 },
          inclusoes: { quantidade: 3, total: null }, // valor ausente
        },
      ],
      comparacoes: [],
    };
    const { porChave } = agregarValoresAnalises(
      [analise({ resultado_completo: rc, hash_excel: "h" })],
      grupo,
    );
    const agreg = porChave.get(`2026-10|${GRUPO}`);
    expect(agreg?.valor).toBe(1000);
    expect(agreg?.situacao).toBe("parcial");
  });

  it("vários resultados no mesmo JSON (um por pagador) somam individualmente", () => {
    const rc = {
      resultados: [
        { pagador: "P1", enfermaria: { beneficiarios: 5, mensalidade: 100, total: 500 } },
        { pagador: "P2", enfermaria: { beneficiarios: 5, mensalidade: 100, total: 500 } },
      ],
      comparacoes: [],
    };
    const { porChave } = agregarValoresAnalises(
      [analise({ resultado_completo: rc, hash_excel: "h" })],
      grupo,
    );
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(1000);
  });
});
