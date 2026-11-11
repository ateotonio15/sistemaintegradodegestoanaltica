import { it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { analisarExcelFinanceiroPorCnpj } from "@/lib/excel-analysis-utils";

it("Prodimagem: retroativo de maio = pivot do RESUMO (31 / R$ 926,87), sem somar linhas da listagem", async () => {
  const b = fs.readFileSync(path.join(__dirname, "fixtures/prodimagem-nov2026.xlsx"));
  const r: any[] = await (analisarExcelFinanceiroPorCnpj as any)(new File([b], "f.xlsx"));
  expect(r[0].retroativas.quantidade).toBe(31);
  expect(r[0].retroativas.total).toBeCloseTo(926.87, 2);
  expect(r[0].enfermaria.total).toBeCloseTo(16032.98, 2);
});
