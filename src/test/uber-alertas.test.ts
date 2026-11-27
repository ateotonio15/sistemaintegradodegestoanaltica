import { describe, it, expect } from "vitest";
import { ALERTAS_PADRAO as P, calcularAlertas, ehNoturnoCfg, normalizarEndereco, rotaDe } from "@/lib/uber-alertas";

const c = (o: any) => ({ id: Math.random().toString(), valor: 20, cancelada: false, data: "2026-11-04", horario: "10:00",
  origem: "R. das Águias, 92 - Manaus", destino: "R. do Luso, 1567 - Manaus", colaborador: "", ...o });

describe("uber alertas", () => {
  it("custo elevado a partir de R$ 60,00", () => {
    const r = calcularAlertas([], [c({ valor: 60 }), c({ valor: 59.99 })] as any, P, []);
    expect(r.corridas.map((x) => x.alertas)).toEqual([["custo"]]);
  });
  it("noturno de 19:00 até 04:59", () => {
    expect(ehNoturnoCfg("19:00", P)).toBe(true); expect(ehNoturnoCfg("04:59", P)).toBe(true);
    expect(ehNoturnoCfg("05:00", P)).toBe(false); expect(ehNoturnoCfg("18:59", P)).toBe(false);
  });
  it("ida e volta são a mesma rota, sem acento/caixa/pontuação", () => {
    const a = rotaDe({ origem: "R. das Águias, 92 - X", destino: "R. do Luso, 1567 - Y" });
    const b = rotaDe({ origem: "r das aguias 92 - Z", destino: "R. DO LUSO, 1567" });
    expect(a?.chave).toBe(b?.chave);
  });
  it("endereço só com cidade fica marcado incompleto", () => {
    expect(normalizarEndereco("Manaus - AM, 69020, Brasil")?.incompleto).toBe(true);
    expect(normalizarEndereco("R. Matrinxã, 1155 - Manaus - AM")?.incompleto).toBe(false);
  });
  it("rota repetida com 5 vezes no período, 4 não", () => {
    const cinco = Array.from({ length: 5 }, () => c({}));
    expect(calcularAlertas([], cinco as any, P, []).repetidas[0].qtd).toBe(5);
    expect(calcularAlertas([], cinco.slice(1) as any, P, []).repetidas).toEqual([]);
  });
  it("preço alto: 50% acima da média de pelo menos 3 outras", () => {
    const outras = [c({ valor: 10 }), c({ valor: 10 }), c({ valor: 10 })];
    const alta = c({ valor: 15 }), baixa = c({ valor: 14.99 });
    const hist = [...outras, alta, baixa] as any;
    const r = calcularAlertas(hist, [alta, baixa] as any, { ...P, repetida_ativo: false }, []);
    // média das demais da alta = (10*3+14.99)/4 = 11.25 → limite 16.87; com 3 mínimas apenas
    const r2 = calcularAlertas([...outras, alta] as any, [alta] as any, { ...P, repetida_ativo: false }, []);
    expect(r2.corridas[0].alertas).toEqual(["rota_preco"]);
    expect(r.corridas.length).toBe(0);
  });
  it("sábado, domingo e feriado ativo com nome", () => {
    const r = calcularAlertas([], [c({ data: "2026-11-07" }), c({ data: "2026-11-20" }), c({ data: "2026-11-05" })] as any, { ...P, repetida_ativo: false }, [{ data: "2026-11-20", nome: "Consciência Negra" }]);
    expect(r.corridas.map((x) => x.feriado)).toEqual(["Consciência Negra", null]);
  });
});
