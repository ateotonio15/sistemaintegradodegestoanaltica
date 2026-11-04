import { it } from "vitest";
import fs from "fs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("adata", async () => {
  const b = fs.readFileSync("/mnt/user-uploads/FATURAMENTO_ADATA_ELECTRONICS_-_RETROATIVO_JUNHO26_A_OUTUBBRO26.xlsx");
  const r = await analisarExcelFinanceiroPorCnpj(new Uint8Array(b).buffer);
  console.log("RES", r.length, r[0].inclusoes, r[0].retroativas?.total, r[0].retroativasReajuste?.total);
});
