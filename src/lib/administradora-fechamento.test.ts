import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { resumirVidasRelatorio, agruparPorAdministradora } from "./administradora-fechamento";
const buf = (rows: unknown[][]) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "A"); return XLSX.write(wb, { type: "array", bookType: "xlsx" }); };
describe("fechamento de administradora", () => {
  it("conta titulares, dependentes e módulos", () => {
    const r = resumirVidasRelatorio(buf([["Nome", "Tipo", "Plano"], ["A", "Titular", "Onix"], ["B", "Dependente", "Onix"], ["C", "Titular", "Onix Plus"]]))!;
    expect([r.titulares, r.dependentes, r.total]).toEqual([2, 1, 3]);
    expect(r.modulos).toEqual([{ nome: "Onix", qtd: 2 }, { nome: "Onix Plus", qtd: 1 }]);
  });
  it("um grupo por administradora", () => {
    expect(agruparPorAdministradora([{ nome: "PLURAL" }, { nome: "Plural " }, { nome: "X" }]).map((g) => g.itens.length)).toEqual([2, 1]);
  });
});
