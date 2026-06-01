import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface VidasFilters {
  mesRef: string; // YYYY-MM
  tipoContrato?: "TODOS" | "EMPRESARIAL" | "ADMINISTRADORA";
  status?: string;
  empresaId?: string;
  search?: string;
}

export interface EmpresaVidas {
  id: string;
  nome: string;
  codigo_contrato: string | null;
  cnpj: string | null;
  tipo_contrato: string;
  status_empresa: string | null;
  vidas: number;
  operadora_plano: string | null;
  responsavel_user_id: string | null;
  executiva_user_id: string | null;
  entradas: number;
  saidas: number;
  total_atual: number;
  total_anterior: number;
  saldo: number;
  ultima_atualizacao: string | null;
}

export interface HistoricoMes {
  mes: string;
  entradas: number;
  saidas: number;
  vidas_ativas: number;
}

function monthsBack(mesRef: string, n: number): string[] {
  const [y, m] = mesRef.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function useGestaoVidas(filters: VidasFilters) {
  const { user, role, isAdmin, isDiretora, isAdministradoras, isComum, isVendas } = useAuth();

  return useQuery({
    queryKey: ["gestao-vidas", filters, user?.id, role],
    enabled: !!user?.id && !!role,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // 1) Empresas (scopo por role)
      let empresasQ = supabase
        .from("empresas")
        .select("id,nome,codigo_contrato,cnpj,tipo_contrato,status_empresa,vidas,operadora_plano,responsavel_user_id,executiva_user_id");

      if (isComum && !isAdministradoras) {
        empresasQ = empresasQ.eq("responsavel_user_id", user!.id);
      }
      // administradoras / diretora / admin / vendas / visualizacao => RLS já filtra/permite
      const { data: empresas, error: e1 } = await empresasQ;
      if (e1) throw e1;

      const empresaIds = (empresas ?? []).map((e) => e.id);
      if (empresaIds.length === 0) {
        return {
          empresas: [] as EmpresaVidas[],
          historico: [] as HistoricoMes[],
        };
      }

      // 2) Histórico do mês atual e anteriores
      const meses = monthsBack(filters.mesRef, 12);
      const { data: hist, error: e2 } = await supabase
        .from("vidas_historico_administradoras")
        .select("empresa_id,mes_referencia,entradas,saidas,total_atual,total_anterior,calculado_em")
        .in("empresa_id", empresaIds)
        .in("mes_referencia", meses);
      if (e2) throw e2;

      const histByEmpresaMes = new Map<string, any>();
      (hist ?? []).forEach((h) => {
        histByEmpresaMes.set(`${h.empresa_id}|${h.mes_referencia}`, h);
      });

      // 3) Monta linhas por empresa (mês corrente)
      const linhas: EmpresaVidas[] = (empresas ?? []).map((emp: any) => {
        const h = histByEmpresaMes.get(`${emp.id}|${filters.mesRef}`);
        const entradas = h?.entradas ?? 0;
        const saidas = h?.saidas ?? 0;
        const total_atual = h?.total_atual ?? emp.vidas ?? 0;
        const total_anterior = h?.total_anterior ?? 0;
        return {
          ...emp,
          entradas,
          saidas,
          total_atual,
          total_anterior,
          saldo: entradas - saidas,
          ultima_atualizacao: h?.calculado_em ?? null,
        } as EmpresaVidas;
      });

      // 4) Aplica filtros de UI
      let filtradas = linhas;
      if (filters.tipoContrato && filters.tipoContrato !== "TODOS") {
        filtradas = filtradas.filter((l) => l.tipo_contrato === filters.tipoContrato);
      }
      if (filters.status && filters.status !== "TODOS") {
        filtradas = filtradas.filter((l) => (l.status_empresa ?? "Ativa") === filters.status);
      }
      if (filters.empresaId) {
        filtradas = filtradas.filter((l) => l.id === filters.empresaId);
      }
      if (filters.search?.trim()) {
        const q = filters.search.toLowerCase();
        filtradas = filtradas.filter(
          (l) =>
            l.nome.toLowerCase().includes(q) ||
            (l.codigo_contrato ?? "").toLowerCase().includes(q) ||
            (l.cnpj ?? "").toLowerCase().includes(q),
        );
      }

      // 5) Série histórica agregada (sobre conjunto filtrado)
      const idsFiltrados = new Set(filtradas.map((l) => l.id));
      const historico: HistoricoMes[] = meses.map((m) => {
        let ent = 0,
          sai = 0,
          ativas = 0;
        for (const id of idsFiltrados) {
          const h = histByEmpresaMes.get(`${id}|${m}`);
          if (h) {
            ent += h.entradas ?? 0;
            sai += h.saidas ?? 0;
            ativas += h.total_atual ?? 0;
          }
        }
        return { mes: m, entradas: ent, saidas: sai, vidas_ativas: ativas };
      });

      return { empresas: filtradas, historico };
    },
  });
}
