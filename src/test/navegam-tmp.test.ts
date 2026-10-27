import { it } from "vitest";
import { readFileSync } from "fs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("x", async () => {
  const b = readFileSync("/mnt/user-uploads/FATURAMENTO_NAVEGAM_PORTAIS_-_AGOSTO2026.xlsx");
  const r = await analisarExcelFinanceiroPorCnpj(new Uint8Array(b) as any);
  console.log(JSON.stringify(r, null, 1));
});
