import { it } from "vitest";
import { readFileSync } from "fs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("x", async () => {
  const b = readFileSync("/mnt/user-uploads/FATURAMENTO_NAVEGAM_PORTAIS_-_AGOSTO2026.xlsx");
  const r = await analisarExcelFinanceiroPorCnpj(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  console.log(JSON.stringify(r, null, 1));
});
