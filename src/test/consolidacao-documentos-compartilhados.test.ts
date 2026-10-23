/**
 * Item 3 — Consolidação de documentos compartilhados + regressões da
 * revisão independente do primeiro pacote (seis problemas).
 *
 * Todos os dados são fictícios.
 */
import { describe, expect, it } from "vitest";
import {
  somarTotalPrevisto,
  somarTotalPrevistoComAvisos,
  type ItemTotalPrevisto,
} from "../lib/previsao-total";
import {
  agregarValoresAnalises,
  reatribuirValoresFiltrados,
  consolidarCompletude,
  type LinhaRelatorio,
  type ChaveValorAgregado,
} from "../lib/financeiro-relatorio-analise-data";
import { VERSAO_RESULTADO_COMPLETO } from "../lib/faturamento-totais";
import { sumPdfTotal } from "../lib/financeiro-analise-lote";

const GRUPO = "grupo-1";

const item = (
  documentos: ItemTotalPrevisto["documentos"],
  opts: Partial<ItemTotalPrevisto> = {},
): ItemTotalPrevisto => ({
  documentos,
  cnpjFiltro: null,
  nomeFiltro: null,
  ...opts,
});

const doc = (path: string, total: number, semSeparacao = false) => ({
  path,
  total,
  semSeparacao,
});

describe("Previsão Financeira — somarTotalPrevisto", () => {
  it("mesmo anexo compartilhado por duas movimentações do grupo conta uma vez", () => {
    const path = "financeiro/mov-origem/planilha.xlsx";
    const total = somarTotalPrevisto([
      item([doc(path, 1000)]),
      item([doc(path, 1000)]),
    ]);
    expect(total).toBe(1000);
  });

  it("dois documentos distintos de R$ 1.000 para o mesmo pagador somam R$ 2.000", () => {
    const total = somarTotalPrevisto([
      item([doc("financeiro/a/doc1.xlsx", 1000)]),
      item([doc("financeiro/b/doc2.xlsx", 1000)]),
    ]);
    expect(total).toBe(2000);
  });

  it("linha-mãe e linha de pagador da mesma movimentação não são deduplicadas entre si", () => {
    const path = "financeiro/mov/planilha.xlsx";
    const total = somarTotalPrevisto([
      item([doc(path, 600)], { cnpjFiltro: "111" }),
      item([doc(path, 400)], { cnpjFiltro: "222" }),
    ]);
    expect(total).toBe(1000);
  });

  it("planilha sem separação por pagador conta o agregado uma única vez", () => {
    const path = "financeiro/mov/sem-pagador.xlsx";
    const total = somarTotalPrevisto([
      item([doc(path, 1000, true)], { cnpjFiltro: "111" }),
      item([doc(path, 1000, true)], { cnpjFiltro: "222" }),
    ]);
    expect(total).toBe(1000);
  });

  // Revisão — Problema 2: documentos mistos
  it("planilha não separável (R$ 1.000) + separável (600+400) totaliza R$ 2.000", () => {
    const agregada = "financeiro/mov/sem-pagador.xlsx";
    const separavel = "financeiro/mov/com-pagador.xlsx";
    const total = somarTotalPrevisto([
      // mesma linha com os dois documentos: a condição "não separável" é do
      // documento, não do conjunto
      item([doc(agregada, 1000, true), doc(separavel, 600)], { cnpjFiltro: "111" }),
      item([doc(agregada, 1000, true), doc(separavel, 400)], { cnpjFiltro: "222" }),
    ]);
    expect(total).toBe(2000); // 1000 (agregado 1×) + 600 + 400
  });

  // Revisão — Problema 3: identificação por nome sem CNPJ
  it("pagadores distintos sem CNPJ usam o nome como identidade e somam as fatias", () => {
    const path = "financeiro/mov/planilha.xlsx";
    const { total, avisos } = somarTotalPrevistoComAvisos([
      item([doc(path, 600)], { nomeFiltro: "Pagador Alfa" }),
      item([doc(path, 400)], { nomeFiltro: "Pagador Beta" }),
    ]);
    expect(total).toBe(1000);
    expect(avisos).toHaveLength(0);
  });

  it("pagador sem CNPJ e sem nome é sinalizado como ambíguo, nunca mesclado", () => {
    const path = "financeiro/mov/planilha.xlsx";
    const { total, avisos } = somarTotalPrevistoComAvisos([
      item([doc(path, 600)]),
      item([doc(path, 600)]),
    ]);
    // Sem identidade inequívoca, trata como repetição do agregado e avisa.
    expect(total).toBe(600);
    expect(avisos.length).toBeGreaterThan(0);
  });
});

const analise = (over: Record<string, unknown>) => ({
  empresa_id: "emp-a",
  mes_referencia: "2026-10",
  hash_excel: null,
  pagador_nome: null,
  pagador_cnpj: null,
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

  // Revisão — Problema 1: hash igual com pagadores distintos NÃO descarta fatia
  it("dois pagadores distintos do mesmo arquivo (600 + 400) somam R$ 1.000", () => {
    const { porChave, duplicadosIgnorados } = agregarValoresAnalises(
      [
        analise({
          hash_excel: "hash-1",
          pagador_cnpj: "11.111.111/0001-11",
          pagador_nome: "Pagador Alfa",
          valor_excel_enfermaria: 600,
        }),
        analise({
          hash_excel: "hash-1",
          pagador_cnpj: "22.222.222/0001-22",
          pagador_nome: "Pagador Beta",
          valor_excel_enfermaria: 400,
        }),
      ],
      grupo,
    );
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(1000);
    expect(duplicadosIgnorados).toBe(0);
  });

  it("pagadores distintos sem CNPJ diferem pelo nome; mesma identidade é repetição", () => {
    const { porChave, duplicadosIgnorados } = agregarValoresAnalises(
      [
        analise({ hash_excel: "hash-1", pagador_nome: "Pagador Alfa", valor_excel_enfermaria: 600 }),
        analise({ hash_excel: "hash-1", pagador_nome: "Pagador Beta", valor_excel_enfermaria: 400 }),
        analise({ hash_excel: "hash-1", pagador_nome: "pagador alfa", valor_excel_enfermaria: 600 }),
      ],
      grupo,
    );
    expect(porChave.get(`2026-10|${GRUPO}`)?.valor).toBe(1000);
    expect(duplicadosIgnorados).toBe(1); // só a repetição exata de Alfa
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

  it("resultado_completo versionado usa o cálculo centralizado e marca completo", () => {
    const rc = {
      meta: { versao: VERSAO_RESULTADO_COMPLETO },
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

  // Revisão — Problema 5: categoria numérica sem evidência de cobertura ≠ completo
  it("JSON antigo com categoria numérica mas sem marca de versão é legado, não completo", () => {
    const rcAntigo = {
      resultados: [
        { pagador: "P1", enfermaria: { beneficiarios: 10, mensalidade: 80, total: 800 } },
      ],
      comparacoes: [],
    };
    const { porChave } = agregarValoresAnalises(
      [analise({ resultado_completo: rcAntigo, hash_excel: "h" })],
      grupo,
    );
    const agreg = porChave.get(`2026-10|${GRUPO}`);
    expect(agreg?.situacao).toBe("legado");
    expect(agreg?.valor).toBe(1000); // valor conhecido das colunas preservado
  });

  it("categoria opcional ausente no JSON versionado não vira erro nem pendência", () => {
    const rc = {
      meta: { versao: VERSAO_RESULTADO_COMPLETO },
      resultados: [
        {
          pagador: "P1",
          enfermaria: { beneficiarios: 10, mensalidade: 100, total: 1000 },
          // permuta, coparticipacao etc. ausentes: opcionais, não somam nem pendem
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
      meta: { versao: VERSAO_RESULTADO_COMPLETO },
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
      meta: { versao: VERSAO_RESULTADO_COMPLETO },
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

// Revisão — Problema 4: filtros no relatório
describe("Relatório analítico — universo filtrado", () => {
  const linha = (id: string, chave: string, valor: number, situacao: LinhaRelatorio["valor_situacao"]) =>
    ({
      id,
      _chave: chave,
      valor,
      valor_situacao: situacao,
    }) as LinhaRelatorio;

  it("filtro que remove a linha portadora reatribui o valor à linha visível da mesma chave", () => {
    const porChave = new Map<string, ChaveValorAgregado>([
      ["2026-10|grupo-1", { chave: "2026-10|grupo-1", valor: 1000, situacao: "completo" }],
    ]);
    // Só restou a segunda linha da chave (a primeira foi filtrada fora).
    const filtradas = [linha("mov-b", "2026-10|grupo-1", 0, "sem_analise")];
    reatribuirValoresFiltrados(filtradas, porChave);
    expect(filtradas[0].valor).toBe(1000);
    expect(filtradas[0].valor_situacao).toBe("completo");
  });

  it("chave inteiramente fora do filtro não entra no consolidado", () => {
    const porChave = new Map<string, ChaveValorAgregado>([
      ["2026-10|grupo-1", { chave: "2026-10|grupo-1", valor: 1000, situacao: "completo" }],
      ["2026-10|grupo-2", { chave: "2026-10|grupo-2", valor: 500, situacao: "legado" }],
    ]);
    const filtradas = [linha("mov-a", "2026-10|grupo-1", 1000, "completo")];
    const c = consolidarCompletude(filtradas, porChave, 0);
    expect(c.completas).toBe(1);
    expect(c.legadas).toBe(0);
    expect(c.valorValidado).toBe(1000);
    expect(c.valorComLimitacao).toBe(0);
  });

  it("valor validado e valor com limitação nunca se somam como total validado", () => {
    const porChave = new Map<string, ChaveValorAgregado>([
      ["2026-10|g1", { chave: "2026-10|g1", valor: 1000, situacao: "completo" }],
      ["2026-10|g2", { chave: "2026-10|g2", valor: 500, situacao: "parcial" }],
    ]);
    const filtradas = [
      linha("a", "2026-10|g1", 1000, "completo"),
      linha("b", "2026-10|g2", 500, "parcial"),
    ];
    const c = consolidarCompletude(filtradas, porChave, 0);
    expect(c.valorValidado).toBe(1000);
    expect(c.valorComLimitacao).toBe(500);
  });
});

// Revisão — Problema 6: sumPdfTotal preserva ausência/falha de leitura
describe("sumPdfTotal — ausência nunca vira zero confirmado", () => {
  it("categoria explicitamente não aplicável não anula total conhecido", () => {
    expect(sumPdfTotal({ enfermaria: { total: { pdf: 9296.10 } }, apartamento: null, inclusoes: { total: { pdf: 873.48 } }, exclusoes: null, devolucoes: null } as any)).toBe(10169.58);
  });
  it("categoria omitida ou valor desconhecido continua inconclusivo", () => {
    expect(sumPdfTotal({ enfermaria: { total: { pdf: 800 } }, apartamento: null, inclusoes: { total: { pdf: null } }, exclusoes: null, devolucoes: null } as any)).toBeNull();
    expect(sumPdfTotal({ enfermaria: { total: { pdf: 800 } }, apartamento: null, inclusoes: null, exclusoes: null } as any)).toBeNull();
  });
  it("simplificada sem exclusões soma inclusões conhecidas", () => {
    expect(sumPdfTotal({ beneficiarios: { pdf: 10 }, inclusoes: { pdf: 150 }, exclusoes: null } as any)).toBe(150);
  });
  it("nenhuma categoria aplicável não confirma zero", () => {
    expect(sumPdfTotal({ enfermaria: null, apartamento: null, inclusoes: null, exclusoes: null, devolucoes: null } as any)).toBeNull();
  });
  it("comparação nula devolve null", () => {
    expect(sumPdfTotal(null)).toBeNull();
  });

  it("simplificada com inclusões/exclusões desconhecidas (pdf null) devolve null", () => {
    expect(
      sumPdfTotal({
        pagador: "P",
        arquivoPdf: "nf.pdf",
        beneficiarios: { excel: 10, pdf: 10, ok: true },
        inclusoes: { excel: 300, pdf: null, ok: false },
        exclusoes: { excel: 0, pdf: null, ok: true },
        divergencias: [],
        avisosPdf: [],
      } as any),
    ).toBeNull();
  });

  it("simplificada com zeros explícitos devolve zero válido", () => {
    expect(
      sumPdfTotal({
        pagador: "P",
        arquivoPdf: "nf.pdf",
        beneficiarios: { excel: 0, pdf: 0, ok: true },
        inclusoes: { excel: 0, pdf: 0, ok: true },
        exclusoes: { excel: 0, pdf: 0, ok: true },
        divergencias: [],
        avisosPdf: [],
      } as any),
    ).toBe(0);
  });

  it("detalhada com qualquer categoria de PDF desconhecida devolve null", () => {
    const cmp = {
      enfermaria: { total: { excel: 800, pdf: 800, ok: true } },
      apartamento: { total: { excel: 0, pdf: 0, ok: true } },
      inclusoes: { total: { excel: 200, pdf: null, ok: false } }, // não encontrado
      exclusoes: { total: { excel: 0, pdf: 0, ok: true } },
      devolucoes: { total: { excel: 0, pdf: 0, ok: true } },
    };
    expect(sumPdfTotal(cmp as any)).toBeNull();
  });

  it("detalhada com todas as categorias conhecidas soma normalmente", () => {
    const cmp = {
      enfermaria: { total: { excel: 800, pdf: 800, ok: true } },
      apartamento: { total: { excel: 0, pdf: 0, ok: true } },
      inclusoes: { total: { excel: 200, pdf: 200, ok: true } },
      exclusoes: { total: { excel: -100, pdf: -100, ok: true } },
      devolucoes: { total: { excel: 0, pdf: 0, ok: true } },
    };
    expect(sumPdfTotal(cmp as any)).toBe(900);
  });
});
