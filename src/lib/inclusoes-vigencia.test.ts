import { describe, it, expect } from "vitest";
import { normalizarCpf, deduplicarInclusoes } from "./inclusoes-vigencia";

const base = { empresa_id: "e1", contrato_id: "2194", fechamento_id: "f1", data_adesao: "2026-11-05" };

describe("inclusões por vigência", () => {
  it("normaliza CPF para somente números", () => {
    expect(normalizarCpf("123.456.789-00")).toBe("12345678900");
  });
  it("não conta o mesmo CPF duas vezes no mesmo fechamento", () => {
    const r = deduplicarInclusoes([{ ...base, cpf: "123.456.789-00" }, { ...base, cpf: "12345678900" }]);
    expect(r).toHaveLength(1);
  });
  it("mesmo CPF em outro fechamento é registro separado", () => {
    const r = deduplicarInclusoes([{ ...base, cpf: "12345678900" }, { ...base, fechamento_id: "f2", cpf: "12345678900" }]);
    expect(r).toHaveLength(2);
  });
  it("ignora o que já existe salvo", () => {
    const r = deduplicarInclusoes([{ ...base, cpf: "12345678900" }], ["e1|2194|12345678900|2026-11-05|f1"]);
    expect(r).toHaveLength(0);
  });
});
