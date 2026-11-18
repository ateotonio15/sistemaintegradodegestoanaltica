import { describe, it, expect } from "vitest";
import { conferirInclusoes, STATUS_DIVERGENCIA } from "./inclusoes-vigencia-conferencia";

const out = { id: "out", mes: "2026-10", cpfsLayout: new Set(["11111111111"]) };
const nov = { id: "nov", mes: "2026-11", cpfsLayout: new Set(["11111111111"]) };

describe("conferência de inclusões por vigência", () => {
  it("atribui pelo mês da adesão, não pela data encontrada", () => {
    const r = conferirInclusoes([{ cpf: "123.456.789-00", nome: "JOÃO", data_adesao: "2026-10-05" }], [out, nov], []);
    expect(r).toEqual([expect.objectContaining({ cpf: "12345678900", fechamento_id: "out" })]);
  });
  it("não registra CPF que já estava no layout do fechamento", () => {
    expect(conferirInclusoes([{ cpf: "11111111111", nome: null, data_adesao: "2026-11-05" }], [nov], [])).toHaveLength(0);
  });
  it("não registra quando o fechamento ainda não foi processado", () => {
    expect(conferirInclusoes([{ cpf: "12345678900", nome: null, data_adesao: "2026-12-05" }], [nov], [])).toHaveLength(0);
  });
  it("reprocessar só adiciona CPFs novos", () => {
    const r = conferirInclusoes(
      [{ cpf: "12345678900", nome: null, data_adesao: "2026-11-05" }, { cpf: "22222222222", nome: null, data_adesao: "2026-11-05" }],
      [nov], [{ cpf: "12345678900", data_adesao: "2026-11-05", fechamento_id: "nov" }]);
    expect(r.map((x) => x.cpf)).toEqual(["22222222222"]);
  });
  it("outra data de adesão vira divergência no fechamento original", () => {
    const r = conferirInclusoes([{ cpf: "12345678900", nome: null, data_adesao: "2026-10-05" }], [out, nov],
      [{ cpf: "12345678900", data_adesao: "2026-11-05", fechamento_id: "nov" }]);
    expect(r).toEqual([expect.objectContaining({ fechamento_id: "nov", status: STATUS_DIVERGENCIA })]);
  });
});
