import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Car, Plus, Upload, Download, Pencil, Trash2, BarChart3, Search } from "lucide-react";
import { useUberCorridas, useDeleteCorrida, type UberCorrida } from "@/hooks/useUberCorridas";
import { CorridaDialog } from "@/components/uber/CorridaDialog";
import { ImportarUberBusinessDialog } from "@/components/uber/ImportarUberBusinessDialog";
import { useAuth } from "@/hooks/useAuth";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const fmtMes = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${MESES_PT[Number(m) - 1]}/${y}`;
};

export default function UberCorridas() {
  const { user, isAdmin, isViewOnly, isVendas, isExecutivo } = useAuth();
  const canManageCorridas = !!user && !isViewOnly && !isVendas;
  const { data: corridas = [], isLoading } = useUberCorridas();
  const del = useDeleteCorrida();

  const [search, setSearch] = useState("");
  const [empresa, setEmpresa] = useState<string>("all");
  const [colaborador, setColaborador] = useState<string>("all");
  const [responsavel, setResponsavel] = useState<string>("all");
  const [mes, setMes] = useState<string>("all");
  const [periodo, setPeriodo] = useState<string>("30");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [uberImportOpen, setUberImportOpen] = useState(false);
  const [status, setStatus] = useState("all");
  const [edit, setEdit] = useState<UberCorrida | null>(null);
  const [toDel, setToDel] = useState<UberCorrida | null>(null);

  const empresas = useMemo(() => Array.from(new Set(corridas.map((c) => c.empresa).filter(Boolean))).sort() as string[], [corridas]);
  const colaboradores = useMemo(() => Array.from(new Set(corridas.map((c) => c.colaborador).filter(Boolean))).sort() as string[], [corridas]);
  const responsaveis = useMemo(() => Array.from(new Set(corridas.map((c) => c.responsavel).filter(Boolean))).sort() as string[], [corridas]);
  const meses = useMemo(
    () => Array.from(new Set(corridas.map((c) => c.data?.slice(0, 7)).filter(Boolean))).sort().reverse() as string[],
    [corridas],
  );

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const usarMes = mes !== "all";
    const usarRange = !usarMes && !!(dataInicio || dataFim);
    const limite = usarMes || usarRange || periodo === "all" ? null : new Date(today.getTime() - Number(periodo) * 86400000);
    const q = search.trim().toLowerCase();
    return corridas.filter((c) => {
      const pend = !c.cancelada && c.status_importacao === "pendente";
      if (status === "pendente" && !pend) return false;
      if (status === "ativa" && (pend || c.cancelada)) return false;
      if (status === "cancelada" && !c.cancelada) return false;
      if (empresa !== "all" && c.empresa !== empresa) return false;
      if (colaborador !== "all" && c.colaborador !== colaborador) return false;
      if (responsavel !== "all" && c.responsavel !== responsavel) return false;
      if (usarMes) {
        if (!c.data || !c.data.startsWith(mes)) return false;
      } else if (usarRange) {
        if (dataInicio && c.data < dataInicio) return false;
        if (dataFim && c.data > dataFim) return false;
      } else if (limite) {
        const [y, m, d] = c.data.split("-").map(Number);
        const dt = new Date(y, m - 1, d);
        if (dt < limite) return false;
      }
      if (q) {
        const hay = `${c.colaborador} ${c.empresa ?? ""} ${c.motivo ?? ""} ${c.origem ?? ""} ${c.destino ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [corridas, empresa, colaborador, responsavel, mes, periodo, dataInicio, dataFim, search, status]);


  const totals = useMemo(() => {
    const validas = filtered.filter((c) => !c.cancelada);
    return {
      qtd: filtered.length,
      ativas: validas.filter((c) => c.status_importacao !== "pendente").length,
      canceladas: filtered.length - validas.length,
      pendentes: filtered.filter((c) => !c.cancelada && c.status_importacao === "pendente").length,
      valor: validas.reduce((s, c) => s + Number(c.valor || 0), 0),
      reembolso: validas.reduce((s, c) => s + Number(c.valor_reembolso ?? c.reembolso ?? 0), 0),
    };
  }, [filtered]);

  const exportar = () => {
    const data = filtered.map((c) => ({
      Data: fmtDate(c.data),
      Horário: c.horario ?? "",
      Colaborador: c.colaborador,
      Origem: c.origem ?? "",
      Destino: c.destino ?? "",
      Motivo: c.motivo ?? "",
      Tipo: c.tipo ?? "",
      "Tipo de serviço (Uber)": c.servico_uber ?? "",
      Empresa: c.empresa ?? "",
      "Forma Pagamento": c.forma_pagamento ?? "",
      Responsável: c.responsavel ?? "",
      "Criado por": c.criado_por ?? "",
      Valor: Number(c.valor || 0),
      "Tem reembolso": c.tem_reembolso ? "Sim" : "Não",
      Reembolso: Number(c.valor_reembolso ?? c.reembolso ?? 0),
      Cancelada: c.cancelada ? "Sim" : "Não",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Corridas");
    XLSX.writeFile(wb, `corridas-uber-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Uber Corporativo</h1>
            <p className="text-sm text-muted-foreground">Corridas, colaboradores e centro de custo</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/uber/dashboard"><BarChart3 className="h-4 w-4 mr-1" />Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          {canManageCorridas && (
            <>
              {(isAdmin || isExecutivo) && <Button variant="outline" size="sm" onClick={() => setUberImportOpen(true)}><Upload className="h-4 w-4 mr-1" />Importar da Uber</Button>}
              <Button size="sm" onClick={() => { setEdit(null); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" />Nova corrida</Button>
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{totals.qtd}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ativas</div><div className="text-2xl font-bold text-emerald-600">{totals.ativas}</div></Card>
        <Card className="p-4 border-amber-500/40"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-bold text-amber-600">{totals.pendentes}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Canceladas</div><div className="text-2xl font-bold text-rose-600">{totals.canceladas}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Valor total</div><div className="text-xl font-semibold">{fmtMoney(totals.valor)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Reembolsos</div><div className="text-xl font-semibold">{fmtMoney(totals.reembolso)}</div></Card>
      </div>

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="ativa">Ativa</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent></Select>
        <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-700 dark:text-amber-400" onClick={() => { setStatus("pendente"); setMes("all"); setDataInicio(""); setDataFim(""); setPeriodo("all"); setEmpresa("all"); setColaborador("all"); setResponsavel("all"); setSearch(""); }}>Ver pendentes</Button>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por colaborador, empresa, motivo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={empresa} onValueChange={setEmpresa}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas empresas</SelectItem>
            {empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={colaborador} onValueChange={setColaborador}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos colaboradores</SelectItem>
            {colaboradores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={responsavel} onValueChange={setResponsavel}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos responsáveis</SelectItem>
            {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {meses.map((m) => <SelectItem key={m} value={m}>{fmtMes(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={periodo} onValueChange={setPeriodo} disabled={mes !== "all" || !!(dataInicio || dataFim)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="365">12 meses</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">De</span>
          <Input type="date" value={dataInicio} disabled={mes !== "all"} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={dataFim} disabled={mes !== "all"} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
          {(dataInicio || dataFim || mes !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setDataInicio(""); setDataFim(""); setMes("all"); }}>Limpar</Button>
          )}
        </div>
      </Card>


      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                {canManageCorridas && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma corrida encontrada</TableCell></TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{fmtDate(c.data)}</TableCell>
                  <TableCell>{c.horario ?? "—"}</TableCell>
                  <TableCell>{c.colaborador || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={c.empresa ?? ""}>{c.empresa ?? "—"}</TableCell>
                  <TableCell>{c.motivo ?? "—"}</TableCell>
                  <TableCell>{c.tipo ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(Number(c.valor || 0))}</TableCell>
                  <TableCell>
                    {!c.cancelada && c.status_importacao === "pendente" && <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40">Pendente</Badge>}
                    {c.cancelada
                      ? <Badge variant="destructive">Cancelada</Badge>
                      : c.status_importacao !== "pendente" && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativa</Badge>}
                  </TableCell>
                  {canManageCorridas && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEdit(c); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDel(c)}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <CorridaDialog open={dialogOpen} onOpenChange={setDialogOpen} corrida={edit} />
      {(isAdmin || isExecutivo) && <ImportarUberBusinessDialog open={uberImportOpen} onOpenChange={setUberImportOpen} />}
      <AlertDialog open={!!toDel} onOpenChange={(o) => !o && setToDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir corrida?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (toDel) { del.mutate(toDel.id); setToDel(null); } }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
