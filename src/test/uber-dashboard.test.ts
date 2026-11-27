import { describe, it, expect } from "vitest";
import { agrupar, contaNoPainel, diaSemanaDe, ehNoturna, periodoAnterior, statusCorrida, NAO_INFORMADO } from "@/lib/uber-dashboard";

const c = (o: any) => ({ valor: 10, tem_reembolso: false, cancelada: false, status_importacao: "completa", colaborador: "", data: "2026-11-02", horario: "10:00", ...o });

describe("uber dashboard", () => {
  it("pendentes ficam fora por padrão e canceladas nunca contam", () => {
    expect(contaNoPainel(c({ status_importacao: "pendente" }), false)).toBe(false);
    expect(contaNoPainel(c({ status_importacao: "pendente" }), true)).toBe(true);
    expect(contaNoPainel(c({ cancelada: true, status_importacao: "pendente" }), true)).toBe(false);
    expect(statusCorrida(c({ cancelada: true }))).toBe("cancelada");
  });
  it("noturna é 19h00 a 04h59", () => {
    expect(ehNoturna(19)).toBe(true); expect(ehNoturna(4)).toBe(true);
    expect(ehNoturna(5)).toBe(false); expect(ehNoturna(18)).toBe(false); expect(ehNoturna(null)).toBe(false);
  });
  it("semana começa na segunda sem deslocar o dia", () => {
    expect(diaSemanaDe("2026-11-02")).toBe(0); // segunda
    expect(diaSemanaDe("2026-11-01")).toBe(6); // domingo
  });
  it("Não informado sempre por último", () => {
    const r = agrupar([c({ empresa: "", valor: 999 }), c({ empresa: "A", valor: 1 })] as any, (x: any) => x.empresa || NAO_INFORMADO);
    expect(r.map((x) => x.nome)).toEqual(["A", NAO_INFORMADO]);
  });
  it("período anterior de mesma duração", () => {
    expect(periodoAnterior("2026-11-01", "2026-11-27")).toEqual({ de: "2026-10-05", ate: "2026-10-31" });
  });
});
