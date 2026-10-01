import { supabase } from "@/integrations/supabase/client";

async function exigirSessao() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão expirada. Entre novamente no sistema.");
}
import { USUARIOS_PERMITIDOS_PRODUCAO_GUIAS, normalizarNomeUsuario } from "@/config/usuariosPermitidos";

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

export async function fetchProducaoGuias(dt_inicio: string, dt_fim: string, nm_empresa?: string): Promise<ProducaoGuiasApi> {
  await exigirSessao();
  const { data, error } = await supabase.functions.invoke("producao-guias-proxy", {
    method: "POST",
    body: { dt_inicio, dt_fim, nm_empresa: nm_empresa || undefined },
  });
  if (error) throw error;
  if (!data?.status) throw new Error(data?.message || "Falha ao consultar a API");
  return filtrarUsuariosPermitidos(data.data as ProducaoGuiasApi);
}

/** Mantém só os usuários permitidos e recalcula todos os totais. */
export function filtrarUsuariosPermitidos(api: ProducaoGuiasApi): ProducaoGuiasApi {
  const permitidos = new Set(USUARIOS_PERMITIDOS_PRODUCAO_GUIAS.map(normalizarNomeUsuario));
  const usuarios = (api.USUARIOS ?? []).filter((u) => permitidos.has(normalizarNomeUsuario(u.USUARIO)));

  if (import.meta.env.DEV) {
    const encontrados = new Set(usuarios.map((u) => normalizarNomeUsuario(u.USUARIO)));
    const faltando = USUARIOS_PERMITIDOS_PRODUCAO_GUIAS.filter((n) => !encontrados.has(normalizarNomeUsuario(n)));
    if (faltando.length) console.info("[Produção de Guias] Usuários da lista não encontrados na API:", faltando);
  }

  const totQtd = usuarios.reduce((s, u) => s + (u.TOTAL?.QTD ?? 0), 0);
  const totPac = usuarios.reduce((s, u) => s + (u.TOTAL?.PACIENTES ?? 0), 0);
  const porTarefa = (api.TAREFAS ?? []).map((t) => {
    let qtd = 0, pac = 0;
    usuarios.forEach((u) => {
      const x = u.TAREFAS.find((y) => y.TAREFA === t);
      if (x) { qtd += x.QTD; pac += x.PACIENTES; }
    });
    return { TAREFA: t, QTD: qtd, PACIENTES: pac };
  });
  const pct = (v: number, t: number) => (t ? Math.round((v / t) * 10000) / 100 : 0);

  return {
    ...api,
    TOTAIS: { QTD: totQtd, PACIENTES: totPac, POR_TAREFA: porTarefa },
    USUARIOS: usuarios.map((u) => ({
      ...u,
      TOTAL: { ...u.TOTAL, PERC_QTD: pct(u.TOTAL.QTD, totQtd), PERC_PACIENTES: pct(u.TOTAL.PACIENTES, totPac) },
    })),
  };
}

export async function fetchEmpresasProducaoGuias(): Promise<string[]> {
  await exigirSessao();
  const { data, error } = await supabase.functions.invoke("producao-guias-proxy", {
    method: "POST",
    body: { acao: "empresas" },
  });
  if (error) throw error;
  if (!data?.status) throw new Error(data?.message || "Falha ao consultar empresas");
  return ((data.data ?? []) as { NM_EMPRESA: string }[]).map((e) => e.NM_EMPRESA).filter(Boolean);
}
