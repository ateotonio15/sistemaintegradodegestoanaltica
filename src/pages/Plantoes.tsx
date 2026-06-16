import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Calendar as CalendarIcon,
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
  const [execFilter, setExecFilter] = useState<string>("all");
  const [atividadeFilter, setAtividadeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recente");
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

  const executivas = useMemo(() => {
    const set = new Set<string>();
    for (const p of plantoes) if (p.plantonista) set.add(p.plantonista);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [plantoes]);

  const atividadeNivel = (total: number) => (total >= 60 ? "alta" : total >= 20 ? "media" : "baixa");

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const arr = porEmpresa.filter((e) => {
      if (empresaFilter !== "all" && e.empresaId !== empresaFilter) return false;
      if (tipoFilter === "com" && !e.plantaoId) return false;
      if (tipoFilter === "sem" && e.plantaoId) return false;
      if (tipoFilter === "sem_plantonista" && !e.semPlantonista) return false;
      if (execFilter !== "all" && e.plantonista !== execFilter) return false;
      if (atividadeFilter !== "all" && atividadeNivel(e.total) !== atividadeFilter) return false;
      if (q && !e.nome.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...arr];
    if (sortBy === "atend_desc") sorted.sort((a, b) => b.total - a.total);
    else if (sortBy === "atend_asc") sorted.sort((a, b) => a.total - b.total);
    else if (sortBy === "nome") sorted.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (sortBy === "plantoes_desc") sorted.sort((a, b) => b.plantoesCount - a.plantoesCount);
    else /* recente */ sorted.sort((a, b) => {
      const ad = a.plantoesDatas.length ? a.plantoesDatas.slice().sort().pop()! : "";
      const bd = b.plantoesDatas.length ? b.plantoesDatas.slice().sort().pop()! : "";
      return bd.localeCompare(ad);
    });
    return sorted;
  }, [porEmpresa, busca, empresaFilter, tipoFilter, execFilter, atividadeFilter, sortBy]);

  const totalAtendimentos = filtered.reduce((acc, e) => acc + e.total, 0);
  const totalPlantoes = filtered.reduce((acc, e) => acc + e.plantoesCount, 0);
  const mediaGeral = totalPlantoes > 0 ? totalAtendimentos / totalPlantoes : 0;

  const limparFiltros = () => {
    setBusca("");
    setEmpresaFilter("all");
    setTipoFilter("all");
    setExecFilter("all");
    setAtividadeFilter("all");
    setSortBy("recente");
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

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[
          { label: "Total Empresas", value: porEmpresa.length.toLocaleString("pt-BR"), Icon: Building2 },
          { label: "Total Atendimentos", value: totalAtendimentos.toLocaleString("pt-BR"), Icon: ClipboardList },
          { label: "Total Plantões", value: totalPlantoes.toLocaleString("pt-BR"), Icon: CalendarIcon },
          { label: "Média Geral / Plantão", value: mediaGeral.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), Icon: BarChart3 },
        ].map(({ label, value, Icon }) => (
          <Card key={label} className="rounded-xl border bg-card card-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
                <div className="text-2xl font-bold leading-tight">{value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar empresa, beneficiário ou CPF..."
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
            <Select value={execFilter} onValueChange={setExecFilter}>
              <SelectTrigger className="md:col-span-2">
                <SelectValue placeholder="Todas as executivas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as executivas</SelectItem>
                {executivas.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={atividadeFilter} onValueChange={setAtividadeFilter}>
              <SelectTrigger className="md:col-span-2">
                <SelectValue placeholder="Todas atividades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas atividades</SelectItem>
                <SelectItem value="alta">Alta atividade</SelectItem>
                <SelectItem value="media">Atividade média</SelectItem>
                <SelectItem value="baixa">Baixa atividade</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="md:col-span-1">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recente">Mais recente</SelectItem>
                <SelectItem value="atend_desc">Mais atendimentos</SelectItem>
                <SelectItem value="atend_asc">Menos atendimentos</SelectItem>
                <SelectItem value="plantoes_desc">Mais plantões</SelectItem>
                <SelectItem value="nome">Nome (A-Z)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="md:col-span-3">
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
              className="md:col-span-2"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="md:col-span-2"
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
