import { formatDateBR } from "@/lib/date-utils";
export { podeVerAvisosCirurgia } from "../../supabase/functions/sincronizar-cirurgias-demandas/regras";
export type AvisoCirurgia = { id: string; demanda_id: string; nome_paciente: string; nome_medico: string; data_cirurgia: string; created_at: string };
export const mensagemCirurgia = (n: AvisoCirurgia) => `O paciente ${n.nome_paciente} teve sua cirurgia agendada para o dia ${formatDateBR(n.data_cirurgia)} pelo Dr. ${n.nome_medico}`;
export const destinoCirurgia = (id: string) => `/demandas?destacar=${encodeURIComponent(id)}`;