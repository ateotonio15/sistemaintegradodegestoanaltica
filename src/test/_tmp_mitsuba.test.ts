import { it } from "vitest";
import fs from "fs";
import { analisarExcelFinanceiroPorCnpj } from "../lib/excel-analysis-utils";
it("mitsuba", async () => {
  const b = fs.readFileSync("/mnt/user-uploads/FATURAMENTO_MITSUBA_DO_-_NOVEMBRO2026.xlsx");
  const ab = new Uint8Array(b).buffer; const r = await analisarExcelFinanceiroPorCnpj(ab as ArrayBuffer);
  console.log(JSON.stringify(r.map((x:any)=>({...x, beneficiarios: undefined, detalhes: undefined})), (k,v)=> Array.isArray(v)&&v.length>20? `[${v.length}]`:v, 1).slice(0,5000));
});
