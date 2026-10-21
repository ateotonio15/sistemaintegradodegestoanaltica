import { describe, it, expect } from "vitest";
import { regexRetroativoNf } from "@/lib/pdf-analysis-utils";

const soma = (t: string) =>
  [...t.matchAll(regexRetroativoNf())].reduce(
    (s, m) => s + Number(m[1].replace(/\./g, "").replace(",", ".")),
    0,
  );

describe("retroativo na NF", () => {
  it("lê 'Retroativo agosto' e 'Retroativo setembro' por mês", () => {
    expect(soma("enfermaria: 30x309,87= 9.296,10 retroativo agosto: 436,74 retroativo setembro: 436,74")).toBeCloseTo(873.48);
  });
  it("mantém 'Cobrança retroativa'", () => {
    expect(soma("cobranca retroativa: 388,52")).toBeCloseTo(388.52);
  });
  it("aceita competência numérica sem confundir com o valor", () => {
    expect(soma("retroacao 08/2026 = r$ 436,74")).toBeCloseTo(436.74);
    expect(soma("retroativo - setembro/26 r$ 436,74")).toBeCloseTo(436.74);
  });
});
