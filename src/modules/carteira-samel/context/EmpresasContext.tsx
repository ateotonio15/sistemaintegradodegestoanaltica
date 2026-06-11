import { createContext, useContext, useMemo, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmpresaCarteira, GrupoTamanho } from "../data/mockData";

interface Ctx {
  empresas: EmpresaCarteira[];
  ativas: EmpresaCarteira[];
  loading: boolean;
  getById: (id: string) => EmpresaCarteira | undefined;
  // legacy no-ops (dados vêm de outras abas)
  add: (...args: any[]) => void;
  update: (...args: any[]) => void;
  inativar: (...args: any[]) => void;
}

const EmpresasContext = createContext<Ctx | null>(null);

function bucketVidas(v: number): GrupoTamanho {
  if (v >= 500) return "≥500";
  if (v >= 100) return "100-499";
  return "30-99";
}

export function EmpresasProvider({ children }: { children: ReactNode }) {
  const { data: empresasDb, isLoading: loadingEmp } = useQuery({
    queryKey: ["carteira-samel", "empresas"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("empresas")
        .select("id,nome,codigo_contrato,data_implantacao,vidas,status_empresa,data_rescisao,contrato_suspenso,tipo_contrato")
        .eq("status_empresa", "Ativa")
        .eq("tipo_contrato", "EMPRESARIAL")
        .lte("data_implantacao", hoje)
        .is("data_rescisao", null)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const ids = useMemo(() => (empresasDb ?? []).map((e) => e.id), [empresasDb]);

  const { data: reajustes, isLoading: loadingRea } = useQuery({
    queryKey: ["carteira-samel", "reajustes", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reajustes_anuais")
        .select("empresa_id,percentual,mes_reajuste,ano,data_aplicacao,created_at")
        .in("empresa_id", ids)
        .order("ano", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const empresas = useMemo<EmpresaCarteira[]>(() => {
    if (!empresasDb) return [];
    const latestByEmp = new Map<string, any>();
    (reajustes ?? []).forEach((r) => {
      if (!latestByEmp.has(r.empresa_id)) latestByEmp.set(r.empresa_id, r);
    });
    return empresasDb.map((e) => {
      const r = latestByEmp.get(e.id);
      const vig = e.data_implantacao ?? new Date().toISOString().slice(0, 10);
      const mesVig = Number(vig.slice(5, 7));
      return {
        id: e.id,
        nome: e.nome,
        contrato: e.codigo_contrato ?? "",
        vigenciaInicio: vig,
        vidas: e.vidas ?? 0,
        reajusteMes: r?.mes_reajuste ?? mesVig,
        reajusteValor: r?.percentual != null ? Number(r.percentual) : 0,
        origemDado: "Importado" as const,
        grupoTamanho: bucketVidas(e.vidas ?? 0),
        inativa: false,
      };
    });
  }, [empresasDb, reajustes]);

  const value = useMemo<Ctx>(
    () => ({
      empresas,
      ativas: empresas,
      loading: loadingEmp || loadingRea,
      getById: (id) => empresas.find((e) => e.id === id),
      add: () => {},
      update: () => {},
      inativar: () => {},
    }),
    [empresas, loadingEmp, loadingRea]
  );

  return <EmpresasContext.Provider value={value}>{children}</EmpresasContext.Provider>;
}

export function useEmpresasCarteira() {
  const ctx = useContext(EmpresasContext);
  if (!ctx) throw new Error("useEmpresasCarteira deve ser usado dentro de EmpresasProvider");
  return ctx;
}
