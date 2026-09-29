import { supabase } from "@/integrations/supabase/client";

export interface TarefaUsuarioApi { TAREFA: string; QTD: number; PERC_QTD: number; PACIENTES: number; PERC_PACIENTES: number }
export interface UsuarioGuiasApi {
  USUARIO: string;
  TAREFAS: TarefaUsuarioApi[];
  TOTAL: { QTD: number; PERC_QTD: number; PACIENTES: number; PERC_PACIENTES: number };
}
export interface ProducaoGuiasApi {
  PERIODO: { DT_INICIO: string; DT_FIM: string };
  TAREFAS: string[];
  TOTAIS: {
    QTD: number;
    PACIENTES: number;
    POR_TAREFA: { TAREFA: string; QTD: number; PACIENTES: number }[];
  };
  USUARIOS: UsuarioGuiasApi[];
}

export async function fetchProducaoGuias(dt_inicio: string, dt_fim: string): Promise<ProducaoGuiasApi> {
  const { data, error } = await supabase.functions.invoke("producao-guias-proxy", {
    method: "POST",
    body: { dt_inicio, dt_fim },
  });
  if (error) throw error;
  if (!data?.status) throw new Error(data?.message || "Falha ao consultar a API");
  return data.data as ProducaoGuiasApi;
}
