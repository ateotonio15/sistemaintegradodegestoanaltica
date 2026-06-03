import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Users, Building, Briefcase, Layers, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchVidasOperadoraAgrupado } from "@/lib/vidasOperadoraApi";
import { Link } from "react-router-dom";

export function VidasOperadoraResumo() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["vidas-operadora-agrupado"],
    queryFn: fetchVidasOperadoraAgrupado,
    staleTime: 5 * 60_000,
  });

  const totals = useMemo(() => {
    const porClass = data?.porClassificacao ?? [];
    const porEmpresa = data?.porEmpresa ?? [];
    const sumBy = (pred: (ds: string) => boolean) =>
      porClass
        .filter((c) => pred((c.DS_CLASSIFICACAO ?? "").toUpperCase()))
        .reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0);
    return {
      total: porClass.reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0),
      empresas: porEmpresa.length,
      empresarial: sumBy((ds) => ds.includes("EMPRESARIAL") && !ds.includes("PME")),
      pme: sumBy((ds) => ds.includes("PME") && !ds.includes("PLURAL")),
      plural: porEmpresa
        .filter((e) => (e.NM_ESTIPULANTE ?? "").toUpperCase().includes("PLURAL"))
        .reduce((a, b) => a + (b.QT_VIDAS ?? 0), 0),
    };
  }, [data]);

  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-lg gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Vidas na Operadora
          {!isLoading && !error && (
            <span className="ml-1 font-bold text-primary">{fmt(totals.total)}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold">Vidas Ativas — Operadora</p>
            <p className="text-xs text-muted-foreground">Fonte: API Samel</p>
          </div>
          <Link to="/vidas-operadora" className="text-xs text-primary hover:underline">
            Detalhar
          </Link>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {error && (
          <p className="text-sm text-destructive">Falha: {(error as Error).message}</p>
        )}

        {!isLoading && !error && (
          <div className="space-y-2">
            <Row icon={<Users className="h-4 w-4 text-primary" />} label="Total de vidas" value={fmt(totals.total)} highlight />
            <Row icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="Empresas" value={fmt(totals.empresas)} />
            <div className="h-px bg-border my-2" />
            <Row icon={<Building className="h-4 w-4 text-info" />} label="Empresarial" value={fmt(totals.empresarial)} />
            <Row icon={<Briefcase className="h-4 w-4 text-warning" />} label="PME" value={fmt(totals.pme)} />
            <Row icon={<Layers className="h-4 w-4 text-success" />} label="Plural" value={fmt(totals.plural)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className={`font-mono ${highlight ? "text-lg font-bold text-primary" : "text-sm font-semibold"}`}>
        {value}
      </span>
    </div>
  );
}
