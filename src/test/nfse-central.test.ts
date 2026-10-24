import { describe, expect, it } from "vitest";
import {
  avaliarValidacao, decidirReenvio, emitidaNoPeriodo, resolverDestino, revisaoFaturamento, type ComparacaoCmp,
} from "../../supabase/functions/_shared/nfse-central-regras";
import { expandirAnexosPorGrupo } from "@/lib/financeiro-utils";

const CNPJ = "12345678000190";
const f = (excel: number, pdf: number | null) => ({ excel, pdf, ok: pdf != null && Math.abs(excel - pdf) < 0.01 });
const cmp = (pdfTotal: number | null, tomador = CNPJ): ComparacaoCmp => ({
  enfermaria: { beneficiarios: f(10, 10), mensalidade: f(100, 100), total: f(1000, pdfTotal) },
  apartamento: null, inclusoes: null, exclusoes: null, devolucoes: null, divergencias: [], tomadorCnpj: tomador,
});
const base = { cnpjTomador: CNPJ, cnpjPagador: CNPJ, emitidaEm: "2026-10-22T08:00:00-04:00", faturado: true, leituraOk: true, valorExcel: 1000 };

describe("Central NFS-e — validação estrita", () => {
  it("aprova somente com diferença de zero centavos", () => {
    expect(avaliarValidacao({ ...base, comparacao: cmp(1000), valorPdf: 1000, valorServico: 1000 }).estado).toBe("aprovado_aguardando_liberacao");
  });
  it("rejeita diferença de R$ 0,01", () => {
    const r = avaliarValidacao({ ...base, comparacao: cmp(1000.01), valorPdf: 1000.01, valorServico: 1000.01 });
    expect(r.aprovado).toBe(false);
    expect(r.diferencaCentavos).toBe(1);
    expect(r.estado).toBe("divergencia");
  });
  it("rejeita CNPJ do tomador divergente do pagador e do PDF", () => {
    expect(avaliarValidacao({ ...base, cnpjPagador: "12345678000271", comparacao: cmp(1000), valorPdf: 1000, valorServico: 1000 }).estado).toBe("divergencia");
    expect(avaliarValidacao({ ...base, comparacao: cmp(1000, "99999999000199"), valorPdf: 1000, valorServico: 1000 }).estado).toBe("divergencia");
  });
  it("não aprova status diferente de Faturado", () => {
    expect(avaliarValidacao({ ...base, faturado: false, comparacao: cmp(1000), valorPdf: 1000, valorServico: 1000 }).estado).toBe("aguardando_faturado");
  });
  it("arquivo ilegível ou valor parcial fica inconclusivo", () => {
    expect(avaliarValidacao({ ...base, leituraOk: false, comparacao: null, valorPdf: null, valorServico: null }).estado).toBe("validacao_inconclusiva");
    expect(avaliarValidacao({ ...base, comparacao: cmp(null), valorPdf: null, valorServico: null }).estado).toBe("validacao_inconclusiva");
  });
  it("valor do serviço bruto diferente do descritivo não é aprovado", () => {
    const r = avaliarValidacao({ ...base, comparacao: cmp(1000), valorPdf: 1000, valorServico: 2000 });
    expect(r.estado).toBe("divergencia");
    expect(r.diferencaCentavos).toBe(100000);
  });
  it("sem valor do serviço bruto fica inconclusivo", () => {
    expect(avaliarValidacao({ ...base, comparacao: cmp(1000), valorPdf: 1000, valorServico: null }).estado).toBe("validacao_inconclusiva");
  });
  it("corte de emissão em 22/10/2026 00:00 de Manaus", () => {
    expect(emitidaNoPeriodo("2026-10-22T00:00:00-04:00")).toBe(true);
    expect(emitidaNoPeriodo("2026-10-21T23:59:59-04:00")).toBe(false);
    expect(emitidaNoPeriodo("2026-10-22")).toBe(false);
  });
});

describe("Central NFS-e — destino", () => {
  const empresas = [{ id: "e1", cnpj: "12.345.678/0001-90" }, { id: "e2", cnpj: "12.345.678/0002-71" }];
  const xls = (mov: string) => ({ id: `x-${mov}`, financeiro_movimentacao_id: mov, nome_arquivo: "fat.xlsx" });
  it("destino ambíguo quando há duas movimentações em Faturado", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], movs: [{ id: "m1", empresa_id: "e1" }, { id: "m2", empresa_id: "e1" }], anexos: [xls("m1"), xls("m2")] });
    expect(r.estado).toBe("destino_ambiguo");
  });
  it("nunca usa filial pela raiz do CNPJ", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], movs: [{ id: "m2", empresa_id: "e2" }], anexos: [xls("m2")] });
    expect(r.estado).toBe("aguardando_faturamento_anexado");
  });
  it("status Nota emitida não é Faturado", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], movs: [{ id: "m1", empresa_id: "e1" }],
      anexos: [xls("m1"), { financeiro_movimentacao_id: "m1", nome_arquivo: "nf.pdf" }] });
    expect(r.estado).toBe("aguardando_faturado");
  });
  it("destino único em Faturado", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], movs: [{ id: "m1", empresa_id: "e1" }], anexos: [xls("m1")] });
    expect(r.destino?.id).toBe("m1");
  });
  it("destino único em Faturado com competência anterior ao mês dos documentos", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [],
      movs: [{ id: "m10", empresa_id: "e1", mes_referencia: "2026-10", periodo: "15-20" }, { id: "m11", empresa_id: "e1", mes_referencia: "2026-11", periodo: "15-20" }],
      anexos: [xls("m10")] });
    expect(r.estado).toBe("aguardando_validacao");
    expect(r.destino?.mes_referencia).toBe("2026-10");
    expect(r.destino?.periodo).toBe("15-20");
  });
  it("dois elegíveis ficam ambíguos mesmo com sugestão da Central", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], sugerida: "m1",
      movs: [{ id: "m1", empresa_id: "e1", mes_referencia: "2026-10" }, { id: "m2", empresa_id: "e1", mes_referencia: "2026-11" }], anexos: [xls("m1"), xls("m2")] });
    expect(r.estado).toBe("destino_ambiguo");
    expect(r.destino).toBeUndefined();
  });
  it("sem Faturado fica pendente com motivo", () => {
    const r = resolverDestino({ cnpjTomador: CNPJ, empresas, pagadores: [], movs: [{ id: "m1", empresa_id: "e1", data_envio_nota: "2026-10-01" }], anexos: [xls("m1")] });
    expect(r.estado).toBe("aguardando_faturado");
    expect(r.motivo).toBeTruthy();
  });
});

describe("Central NFS-e — grupos, reenvios e concorrência", () => {
  it("nota da Central não é replicada para outro contrato do grupo", () => {
    const movs = [{ id: "a", empresa_id: "ea", mes_referencia: "2026-10", periodo: "01-05" }, { id: "b", empresa_id: "eb", mes_referencia: "2026-10", periodo: "01-05" }];
    const grupo = new Map([["ea", "g"], ["eb", "g"]]);
    const mapa = expandirAnexosPorGrupo(movs, [{ financeiro_movimentacao_id: "a", origem: "central_nfse" }, { financeiro_movimentacao_id: "a", origem: "normal" }], grupo);
    expect(mapa.get("b")?.map((x) => x.origem)).toEqual(["normal"]);
  });
  it("reenvio com mesmo PDF é idempotente e com PDF diferente é conflito", () => {
    expect(decidirReenvio({ pdf_sha256: "aa" }, "aa")).toBe("mesmo");
    expect(decidirReenvio({ pdf_sha256: "aa" }, "bb")).toBe("conflito");
  });
  it("revisão muda quando o faturamento é alterado durante a análise", () => {
    expect(revisaoFaturamento(["b", "a"])).toBe("a,b");
    expect(revisaoFaturamento(["a", "b", "c"])).not.toBe(revisaoFaturamento(["a", "b"]));
  });
});
