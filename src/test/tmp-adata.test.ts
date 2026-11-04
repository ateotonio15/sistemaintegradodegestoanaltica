import { it } from "vitest";
import fs from "fs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("adata", async () => {
  const b = fs.readFileSync("/mnt/user-uploads/FATURAMENTO_ADATA_ELECTRONICS_-_RETROATIVO_JUNHO26_A_OUTUBBRO26.xlsx");
  const ab = new Uint8Array(b).buffer; const r = await analisarExcelFinanceiroPorCnpj(ab);
  console.log(JSON.stringify(r.map(x=>({...x, beneficiarios: undefined})), null, 1).slice(0,3000));
});
