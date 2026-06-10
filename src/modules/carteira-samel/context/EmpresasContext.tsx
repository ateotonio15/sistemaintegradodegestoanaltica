import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { mockEmpresas, EmpresaCarteira } from "../data/mockData";

interface Ctx {
  empresas: EmpresaCarteira[];
  ativas: EmpresaCarteira[];
  add: (e: Omit<EmpresaCarteira, "id" | "reajusteMes"> & { reajusteMes?: number }) => void;
  update: (id: string, patch: Partial<EmpresaCarteira>) => void;
  inativar: (id: string, motivo: string) => void;
  getById: (id: string) => EmpresaCarteira | undefined;
}

const EmpresasContext = createContext<Ctx | null>(null);

function recalcMes(vigenciaISO: string): number {
  const d = new Date(vigenciaISO + "T00:00:00");
  return d.getMonth() + 1;
}

export function EmpresasProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaCarteira[]>(mockEmpresas);

  const add: Ctx["add"] = useCallback((e) => {
    setEmpresas((prev) => [
      ...prev,
      { ...e, id: crypto.randomUUID(), reajusteMes: e.reajusteMes ?? recalcMes(e.vigenciaInicio) },
    ]);
  }, []);

  const update: Ctx["update"] = useCallback((id, patch) => {
    setEmpresas((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next = { ...e, ...patch };
        if (patch.vigenciaInicio) next.reajusteMes = recalcMes(patch.vigenciaInicio);
        return next;
      })
    );
  }, []);

  const inativar: Ctx["inativar"] = useCallback((id, motivo) => {
    setEmpresas((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, inativa: true, motivoInativacao: motivo, dataInativacao: new Date().toISOString().slice(0, 10) } : e
      )
    );
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      empresas,
      ativas: empresas.filter((e) => !e.inativa),
      add,
      update,
      inativar,
      getById: (id) => empresas.find((e) => e.id === id),
    }),
    [empresas, add, update, inativar]
  );

  return <EmpresasContext.Provider value={value}>{children}</EmpresasContext.Provider>;
}

export function useEmpresasCarteira() {
  const ctx = useContext(EmpresasContext);
  if (!ctx) throw new Error("useEmpresasCarteira deve ser usado dentro de EmpresasProvider");
  return ctx;
}
