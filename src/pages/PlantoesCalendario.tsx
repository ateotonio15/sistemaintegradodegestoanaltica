import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowLeft, Download, Plus, X } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoes, usePlantoesRealtime, type Plantao } from "@/hooks/usePlantoes";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { useFeriados } from "@/hooks/useFeriados";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type StatusFiltro = "todos" | "andamento" | "finalizado";

export default function PlantoesCalendario() {
  usePlantoesRealtime();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const { data: empresas = [] } = usePlantaoEmpresas();
  const { data: plantoes = [] } = usePlantoes({ from: fmt(monthStart), to: fmt(monthEnd) });

  const [empresaId, setEmpresaId] = useState<string>("todas");
  const [executiva, setExecutiva] = useState<string>("todas");
  const [status, setStatus] = useState<StatusFiltro>("todos");
  const [novo, setNovo] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [novoData, setNovoData] = useState<string | null>(null);

  const today = fmt(new Date());

  const { data: feriadosAno = [] } = useFeriados(cursor.getFullYear());
  const feriadoMap = useMemo(() => {
    const m = new Map(feriadosAno.map((f) => [f.data, f]));
    return m;
  }, [feriadosAno]);

  const executivas = useMemo(() => {
    const set = new Set<string>();
    plantoes.forEach((p) => p.plantonista && set.add(p.plantonista));
    return Array.from(set).sort();
  }, [plantoes]);

  const filtrados = useMemo(() => {
    return plantoes.filter((p) => {
      if (empresaId !== "todas" && p.empresa_id !== empresaId) return false;
      if (executiva !== "todas" && (p.plantonista ?? "") !== executiva) return false;
      if (status !== "todos") {
        const isAndamento = p.data === today;
        if (status === "andamento" && !isAndamento) return false;
        if (status === "finalizado" && isAndamento) return false;
      }
      return true;
    });
  }, [plantoes, empresaId, executiva, status, today]);

  const byDay = useMemo(() => {
    const m = new Map<string, Plantao[]>();
    for (const p of filtrados) {
      const arr = m.get(p.data) ?? [];
      arr.push(p);
      m.set(p.data, arr);
    }
    return m;
  }, [filtrados]);

  const dias: (Date | null)[] = [];
  const firstWeekday = monthStart.getDay();
  for (let i = 0; i < firstWeekday; i++) dias.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) dias.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const selectedList = selected ? byDay.get(selected) ?? [] : [];

  const limparFiltros = () => {
    setEmpresaId("todas");
    setExecutiva("todas");
    setStatus("todos");
  };

  const exportExcel = () => {
    const rows = filtrados.map((p) => ({
      Data: new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR"),
      Empresa: p.empresa?.nome ?? "",
      Executiva: p.plantonista ?? "",
      Turno: p.turno,
      Status: p.data === today ? "Em andamento" : "Finalizado",
      Atendimentos: p.atendimentos_count ?? 0,
      Observação: p.observacao ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calendário");
    const mes = cursor.toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }).replace("/", "-");
    XLSX.writeFile(wb, `calendario_plantoes_${mes}.xlsx`);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Calendário de Plantões</h1>
          <p className="text-sm text-muted-foreground">Você pode criar, editar e excluir eventos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          {isAdmin && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo evento
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[200px] flex-1">
            <Label className="text-xs">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {empresas.filter((e) => e.ativo).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[200px] flex-1">
            <Label className="text-xs">Executiva(o)</Label>
            <Select value={executiva} onValueChange={setExecutiva}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {executivas.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[180px] flex-1">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFiltro)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="andamento">Em andamento</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        </CardContent>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          Feriado Nacional
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
          Feriado Estadual - Amazonas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          Feriado Municipal - Manaus
        </span>
      </div>

      {/* Navegação mês */}
      <div className="flex items-center justify-center gap-3">
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="font-semibold capitalize min-w-[180px] text-center">
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendário */}
      <Card><CardContent className="p-4">
        <div className="grid grid-cols-7 gap-1 text-xs font-medium text-muted-foreground mb-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {dias.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = fmt(d);
            const items = byDay.get(key) ?? [];
            const isSel = selected === key;
            const isHoje = key === today;
            const fer = feriadoMap.get(key);
            const bg = fer?.tipo === "Nacional"
              ? "bg-rose-50"
              : fer?.tipo === "Estadual"
                ? "bg-orange-50"
                : fer?.tipo === "Municipal"
                  ? "bg-amber-50"
                  : "";
            const dot = fer?.tipo === "Nacional"
              ? "bg-rose-400"
              : fer?.tipo === "Estadual"
                ? "bg-orange-400"
                : fer?.tipo === "Municipal"
                  ? "bg-amber-400"
                  : "";
            return (
              <button
                key={i}
                onClick={() => {
                  setSelected(key);
                  if (isAdmin) {
                    setNovoData(key);
                    setNovo(true);
                  }
                }}
                className={`min-h-[88px] p-1.5 border rounded text-left text-xs hover:bg-muted/50 transition ${bg} ${isSel ? "ring-2 ring-primary" : ""} ${isHoje ? "border-primary" : ""}`}
                title={fer?.nome ?? ""}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${isHoje ? "text-primary" : ""}`}>{d.getDate()}</span>
                  {fer && <span className={`h-2 w-2 rounded-full ${dot}`} />}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 2).map((p) => (
                    <div key={p.id} className="truncate rounded bg-emerald-100 text-emerald-800 px-1 py-0.5 text-[10px]">
                      {p.plantonista || p.empresa?.nome}
                    </div>
                  ))}
                  {items.length > 2 && (
                    <Badge variant="secondary" className="text-[10px]">+{items.length - 2}</Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent></Card>

      {selected && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="font-semibold">
            Plantões em {new Date(selected + "T00:00:00").toLocaleDateString("pt-BR")}
          </div>
          {selectedList.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum plantão neste dia.</div>
          ) : selectedList.map((p) => (
            <Link key={p.id} to={`/plantoes/empresa/${p.empresa_id}`} className="block border rounded p-2 hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.empresa?.nome}</div>
                  <div className="text-xs text-muted-foreground">{p.turno} · {p.plantonista || "sem plantonista"}</div>
                </div>
                <Badge variant="outline">{p.atendimentos_count} atend.</Badge>
              </div>
            </Link>
          ))}
        </CardContent></Card>
      )}

      {novo && <PlantaoDialog open={novo} onOpenChange={setNovo} />}
    </div>
  );
}
