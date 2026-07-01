import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Stethoscope, Search, LayoutGrid, List, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { formatDateBR } from "@/lib/date-utils";
import { NovaAcaoDialog } from "../components/NovaAcaoDialog";
import { useEmpresasComAcoes, useEnfermeiras, useSaudeRealtime, type AcaoSaudeTipo } from "../hooks/useSaudeEmpresas";

export default function SaudeEmpresasLista() {
  useSaudeRealtime();
  const { isAdmin, isEnfermeira } = useAuth();
  const canEdit = isAdmin || isEnfermeira;

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [enfermeiraId, setEnfermeiraId] = useState<string>("all");
  const [tipo, setTipo] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dlg, setDlg] = useState(false);

  const { data: enfs = [] } = useEnfermeiras();
  const { data: empresas = [], isLoading } = useEmpresasComAcoes({
    from: from || undefined,
    to: to || undefined,
    enfermeiraId: enfermeiraId === "all" ? undefined : enfermeiraId,
    tipo: tipo === "all" ? undefined : (tipo as AcaoSaudeTipo),
  });

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return empresas.filter((e: any) => {
      if ((e.total_acoes ?? 0) === 0 && (e.total_triagens ?? 0) === 0) return false;
      return (
        !q ||
        e.nome.toLowerCase().includes(q) ||
        (e.codigo_contrato ?? "").toLowerCase().includes(q) ||
        (e.cnpj ?? "").toLowerCase().includes(q)
      );
    });
  }, [empresas, busca]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Saúde nas Empresas</h1>
            <p className="text-sm text-muted-foreground">Ações, triagens e fichas de bioimpedância</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><Link to="/saude-empresas/visao-geral"><BarChart3 className="h-4 w-4 mr-1" />Visão geral</Link></Button>
          {canEdit && <Button onClick={() => setDlg(true)}><Plus className="h-4 w-4 mr-1" />Nova ação</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Nome, contrato ou CNPJ" className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="De" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Até" />
          <Select value={enfermeiraId} onValueChange={setEnfermeiraId}>
            <SelectTrigger><SelectValue placeholder="Enfermeira" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas enfermeiras</SelectItem>
              {enfs.map((e) => <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="triagem">Triagem</SelectItem>
              <SelectItem value="palestra">Palestra</SelectItem>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="bioimpedancia">Bioimpedância</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} empresa(s)</p>
        <div className="flex border rounded-md p-0.5">
          <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e: any) => (
            <Link to={`/saude-empresas/empresa/${e.id}`} key={e.id}>
              <Card className="hover:border-primary/40 transition-colors h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />{e.nome}</CardTitle>
                    {e.risco_alto > 0 && <Badge variant="destructive">{e.risco_alto} risco alto</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{e.codigo_contrato ?? "—"}</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><div className="text-2xl font-semibold">{e.total_acoes}</div><div className="text-xs text-muted-foreground">Ações</div></div>
                    <div><div className="text-2xl font-semibold">{e.total_triagens}</div><div className="text-xs text-muted-foreground">Triagens</div></div>
                    <div><div className="text-xs">Última</div><div className="text-sm font-medium">{e.ultima_acao ? formatDateBR(e.ultima_acao) : "—"}</div></div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                  <TableHead className="text-right">Triagens</TableHead>
                  <TableHead className="text-right">Risco alto</TableHead>
                  <TableHead>Última ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: any) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => (window.location.href = `/saude-empresas/empresa/${e.id}`)}>
                    <TableCell className="font-medium">{e.nome}</TableCell>
                    <TableCell>{e.codigo_contrato ?? "—"}</TableCell>
                    <TableCell className="text-right">{e.total_acoes}</TableCell>
                    <TableCell className="text-right">{e.total_triagens}</TableCell>
                    <TableCell className="text-right">{e.risco_alto > 0 ? <Badge variant="destructive">{e.risco_alto}</Badge> : "—"}</TableCell>
                    <TableCell>{e.ultima_acao ? formatDateBR(e.ultima_acao) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NovaAcaoDialog open={dlg} onOpenChange={setDlg} onSaved={(id) => (window.location.href = `/saude-empresas/acao/${id}`)} />
    </div>
  );
}
