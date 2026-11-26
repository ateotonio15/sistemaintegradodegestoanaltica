import { supabase } from "@/integrations/supabase/client";
import type { UberCorrida } from "@/hooks/useUberCorridas";
import * as XLSX from "xlsx";

export async function lerTodasCorridasUber(): Promise<UberCorrida[]> {
  const rows: UberCorrida[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.from("uber_corridas").select("*").order("id").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data ?? []) as unknown as UberCorrida[]);
    if (!data || data.length < 1000) return rows;
  }
}
export async function backupUber() {
  const corridas = await lerTodasCorridasUber();
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(corridas), "Corridas");
  const d = new Date();
  XLSX.writeFile(wb, `backup-corridas-uber-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.xlsx`);
}