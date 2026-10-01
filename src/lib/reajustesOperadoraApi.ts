import { supabase } from "@/integrations/supabase/client";

async function exigirSessao() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Sessão expirada. Entre novamente no sistema.");
}

export interface FaixaApi { QT_IDADE_INICIAL: number; QT_IDADE_FINAL: number; VL_PRECO_ATUAL: number }
export interface PlanoApi { NR_SEQ_PLANO: number; NM_FANTASIA: string; FAIXAS_ETARIAS: FaixaApi[] }
export interface ReajusteContratoApi {
  NR_SEQ_CONTRATO: number;
  NR_CONTRATO: number;
  NM_CONTRATO: string;
  TX_REAJUSTE: number;
  DT_REAJUSTE: string;
  PLANOS: PlanoApi[];
}

export async function fetchReajustesOperadora(): Promise<ReajusteContratoApi[]> {
  await exigirSessao();
  const { data, error } = await supabase.functions.invoke("reajustes-operadora-proxy", { method: "GET" });
  if (error) throw error;
  if (!data?.status) throw new Error(data?.message || "Falha ao consultar a API");
  return (data.data ?? []) as ReajusteContratoApi[];
}

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function modalidadePlano(nome: string): "enfermaria" | "apartamento" | null {
  const n = norm(nome);
  if (n.includes("executivo") || n.includes("apartamento")) return "apartamento";
  if (n.includes("empresarial") || n.includes("enfermaria") || /\benf\b/.test(n)) return "enfermaria";
  return null;
}

export interface FaixaCalc { idade_inicial: number; idade_final: number; antigo: number; reajustado: number }

/** VL_PRECO_ATUAL = valor já reajustado; antigo = atual / (1 + tx/100). Valores em centavos. */
export function calcularFaixas(plano: PlanoApi, tx: number): FaixaCalc[] {
  const fator = 1 + (tx || 0) / 100;
  return (plano.FAIXAS_ETARIAS ?? []).map((f) => {
    const reaj = Math.round(Number(f.VL_PRECO_ATUAL || 0) * 100);
    return {
      idade_inicial: f.QT_IDADE_INICIAL,
      idade_final: f.QT_IDADE_FINAL,
      reajustado: reaj,
      antigo: fator > 0 ? Math.round(reaj / fator) : reaj,
    };
  });
}

export function parseDataReajuste(iso: string): { data: string; ano: number; mes: number } | null {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { data: `${m[1]}-${m[2]}-${m[3]}`, ano: +m[1], mes: +m[2] };
}
