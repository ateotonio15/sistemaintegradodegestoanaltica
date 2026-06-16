import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantaoMutations, usePlantoes, usePlantoesRealtime, type PlantaoEmpresa } from "@/hooks/usePlantoes";
import { PlantaoEmpresaDialog } from "@/components/plantoes/PlantaoEmpresaDialog";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { PlantaoLoteDialog } from "@/components/plantoes/PlantaoLoteDialog";
import { EmpresaPlantaoCard } from "@/components/plantoes/EmpresaPlantaoCard";
import { format } from "date-fns";

export default function Plantoes() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  usePlantoesRealtime();

  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(today);
  const [to, setTo] = useState<string>(today);
  const [busca, setBusca] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const { data: empresas = [] } = usePlantaoEmpresas();
  const { data: plantoes = [] } = usePlantoes({ from, to });

  const [empDialog, setEmpDialog] = useState(false);
  const [empEditar, setEmpEditar] = useState<PlantaoEmpresa | null>(null);
  const [plantaoDialog, setPlantaoDialog] = useState(false);
  const [loteDialog, setLoteDialog] = useState(false);
  const { deleteEmpresa } = usePlantaoMutations();

  const porEmpresa = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; total: number; plantonista: string | null; semPlantonista: boolean; plantaoId: string | null; plantoesIds: string[]; plantoesDatas: string[]; plantoesCount: number }
    >();
    for (const e of empresas) {
      map.set(e.id, { nome: e.nome, total: 0, plantonista: null, semPlantonista: false, plantaoId: null, plantoesIds: [], plantoesDatas: [], plantoesCount: 0 });
    }
    for (const p of plantoes) {
      const cur = map.get(p.empresa_id);
      if (!cur) continue;
      cur.total += p.atendimentos_count ?? 0;
      cur.plantonista = cur.plantonista ?? p.plantonista;
      if (!p.plantonista) cur.semPlantonista = true;
      cur.plantaoId = cur.plantaoId ?? p.id;
      cur.plantoesIds.push(p.id);
      cur.plantoesDatas.push(p.data);
      cur.plantoesCount += 1;
    }
    return Array.from(map.entries()).map(([id, v]) => ({ empresaId: id, ...v }));
  }, [empresas, plantoes]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return porEmpresa.filter((e) => {
      if (empresaFilter !== "all" && e.empresaId !== empresaFilter) return false;
      if (tipoFilter === "com" && !e.plantaoId) return false;
      if (tipoFilter === "sem" && e.plantaoId) return false;
      if (tipoFilter === "sem_plantonista" && !e.semPlantonista) return false;
      if (q && !e.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [porEmpresa, busca, empresaFilter, tipoFilter]);

  const totalAtendimentos = filtered.reduce((acc, e) => acc + e.total, 0);

  const limparFiltros = () => {
    setBusca("");
    setEmpresaFilter("all");
    setTipoFilter("all");
    setFrom(today);
    setTo(today);
  };

  const exportExcel = () => {
    const rows = filtered.map((e) => ({
      Empresa: e.nome,
      Plantonista: e.plantonista || "",
      Atendimentos: e.total,
      Status: e.plantaoId ? "Em plantão" : "Sem plantão",
      "Sem plantonista": e.semPlantonista ? "Sim" : "Não",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantoes");
    XLSX.writeFile(wb, `plantoes_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportPDF = () => window.print();

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Plantões 24h
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {porEmpresa.length} empresas · {porEmpresa.reduce((a, e) => a + e.total, 0)} atendimentos no total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/plantoes/relatorios">
              <BarChart3 className="h-4 w-4 mr-1" /> Ver dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setEmpDialog(true)}>
                <Building2 className="h-4 w-4 mr-1" /> Empresa
              </Button>
              <Button onClick={() => setLoteDialog(true)}>
                <Plus className="h-4 w-4 mr-1" /> Novo lote
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Empresa, beneficiário ou CPF"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Select value={empresaFilter} onValueChange={setEmpresaFilter}>
              <SelectTrigger className="md:col-span-3">
                <SelectValue placeholder="Todas as empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as empresas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="md:col-span-2">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="com">Em plantão</SelectItem>
                <SelectItem value="sem">Sem plantão</SelectItem>
                <SelectItem value="sem_plantonista">Sem plantonista</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="md:col-span-1.5"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="md:col-span-1.5"
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={limparFiltros}
              className="text-sm font-medium text-primary hover:underline"
            >
              Limpar filtros
            </button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{filtered.length} empresas · {totalAtendimentos} atendimentos</span>
              <div className="flex border rounded-md p-0.5 ml-2">
                <Button
                  size="sm"
                  variant={view === "grid" ? "secondary" : "ghost"}
                  onClick={() => setView("grid")}
                  className="h-7 px-2"
                >
                  <LayoutGrid className="h-4 w-4 mr-1" /> Grade
                </Button>
                <Button
                  size="sm"
                  variant={view === "list" ? "secondary" : "ghost"}
                  onClick={() => setView("list")}
                  className="h-7 px-2"
                >
                  <List className="h-4 w-4 mr-1" /> Lista
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum resultado para os filtros aplicados. {isAdmin && porEmpresa.length === 0 && "Use o botão Empresa para cadastrar a primeira."}
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {filtered.map((e) => {
            const empresa = empresas.find((x) => x.id === e.empresaId);
            return (
              <EmpresaPlantaoCard
                key={e.empresaId}
                empresaId={e.empresaId}
                nome={e.nome}
                plantoesIds={e.plantoesIds}
                plantoesDatas={e.plantoesDatas}
                plantonista={e.plantonista}
                totalAtendimentos={e.total}
                totalPlantoes={e.plantoesCount}
                from={from}
                to={to}
                isAdmin={isAdmin}
                onEdit={empresa ? () => setEmpEditar(empresa) : undefined}
                onDelete={empresa ? () => {
                  if (confirm(`Remover empresa "${empresa.nome}"? Todos os plantões e atendimentos serão excluídos.`)) {
                    deleteEmpresa.mutate(empresa.id);
                  }
                } : undefined}
              />
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Plantonista</TableHead>
                  <TableHead className="text-right">Atendimentos</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow
                    key={e.empresaId}
                    className="cursor-pointer"
                    onClick={() => (window.location.href = `/plantoes/empresa/${e.empresaId}`)}
                  >
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell>{e.plantonista || "—"}</TableCell>
                    <TableCell className="text-right">{e.total}</TableCell>
                    <TableCell>
                      {e.plantaoId ? (
                        <Badge variant="secondary">Em plantão</Badge>
                      ) : (
                        <Badge variant="outline">Sem plantão</Badge>
                      )}
                      {e.semPlantonista && e.plantaoId && (
                        <Badge variant="destructive" className="ml-2 text-[10px]">Sem plantonista</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setPlantaoDialog(true)}>
            <Users className="h-4 w-4 mr-1" /> Novo plantão individual
          </Button>
        </div>
      )}

      {empDialog && <PlantaoEmpresaDialog open={empDialog} onOpenChange={setEmpDialog} />}
      {empEditar && <PlantaoEmpresaDialog open={!!empEditar} onOpenChange={(o) => !o && setEmpEditar(null)} empresa={empEditar} />}
      {plantaoDialog && <PlantaoDialog open={plantaoDialog} onOpenChange={setPlantaoDialog} />}
      {loteDialog && <PlantaoLoteDialog open={loteDialog} onOpenChange={setLoteDialog} />}
    </div>
  );
}
