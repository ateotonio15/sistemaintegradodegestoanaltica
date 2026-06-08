import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Bike, Calendar, CalendarClock, AlertTriangle, CheckCircle2, Search, Check } from "lucide-react";
import { ImportarHondaDialog } from "@/components/honda/ImportarHondaDialog";
import { HondaMotoProgress } from "@/components/honda/HondaMotoProgress";
import { HondaAlertasBanner } from "@/components/honda/HondaAlertasBanner";
import {
  useHondaExclusoes,
  useCanAccessHonda,
  getHondaStatus,
  getDiasRestantes,
  type HondaExclusao,
  type HondaStatus,
} from "@/hooks/useHondaExclusoes";
import { formatCpf } from "@/lib/honda-exclusoes-import";
import { formatDateBR } from "@/lib/date-utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Navigate } from "react-router-dom";

function StatusBadge({ status }: { status: HondaStatus }) {
  const map: Record<HondaStatus, string> = {
    Programado: "bg-muted text-muted-foreground border-muted",
    Amanhã: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
    Hoje: "bg-primary/15 text-primary border-primary/40",
    Concluído: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    Atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={cn("font-medium", map[status])}>{status}</Badge>;
}

interface RowProps {
  item: HondaExclusao;
  showMoto?: boolean;
  onToggle?: (item: HondaExclusao) => void;
}

function Linha({ item, showMoto, onToggle }: RowProps) {
  const dias = getDiasRestantes(item);
  const status = getHondaStatus(item);
  return (
    <TableRow>
      <TableCell className="font-medium">{item.nome_beneficiario}</TableCell>
      <TableCell className="font-mono text-xs">{formatCpf(item.cpf)}</TableCell>
      <TableCell>{formatDateBR(item.data_demissao)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{item.motivo || "—"}</TableCell>
      <TableCell className="tabular-nums">
        {showMoto && status !== "Concluído" ? (
          <HondaMotoProgress diasRestantes={dias} showLabel />
        ) : dias < 0 ? (
          <span className="text-destructive">{Math.abs(dias)}d atrás</span>
        ) : dias === 0 ? "Hoje" : dias === 1 ? "Amanhã" : `${dias}d`}
      </TableCell>
      <TableCell><StatusBadge status={status} /></TableCell>
      {onToggle && (
        <TableCell>
          <Button size="sm" variant={item.concluido ? "outline" : "default"} onClick={() => onToggle(item)}>
            <Check className="h-3 w-3 mr-1" />
            {item.concluido ? "Reabrir" : "Concluir"}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

export default function HondaExclusoes() {
  const { data: canAccess, isLoading: checking } = useCanAccessHonda();
  const { data: rows = [], isLoading } = useHondaExclusoes();
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterMes, setFilterMes] = useState<string>("all");
  const [filterAno, setFilterAno] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMotivo, setFilterMotivo] = useState<string>("all");
  const qc = useQueryClient();
  const { toast } = useToast();

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const kpi = useMemo(() => {
    let programadas = 0, mes = 0, semana = 0, amanha = 0, vencidas = 0;
    const startWeek = new Date(today);
    const endWeek = new Date(today);
    endWeek.setDate(endWeek.getDate() + 7);
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    for (const r of rows) {
      const [y, m, d] = r.data_demissao.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      dt.setHours(0, 0, 0, 0);
      if (!r.concluido && dt >= today) programadas++;
      if (dt >= startMonth && dt <= endMonth) mes++;
      if (dt >= startWeek && dt <= endWeek) semana++;
      const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
      if (diff === 1) amanha++;
      if (!r.concluido && dt < today) vencidas++;
    }
    return { programadas, mes, semana, amanha, vencidas };
  }, [rows, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const cpfDigits = r.cpf.replace(/\D/g, "");
        if (!r.nome_beneficiario.toLowerCase().includes(q) && !cpfDigits.includes(q.replace(/\D/g, ""))) {
          return false;
        }
      }
      const [y, m] = r.data_demissao.split("-").map(Number);
      if (filterMes !== "all" && m !== Number(filterMes)) return false;
      if (filterAno !== "all" && y !== Number(filterAno)) return false;
      if (filterStatus !== "all" && getHondaStatus(r) !== filterStatus) return false;
      if (filterMotivo !== "all" && (r.motivo || "—") !== filterMotivo) return false;
      return true;
    });
  }, [rows, search, filterMes, filterAno, filterStatus, filterMotivo]);

  const motivos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.motivo || "—"))).sort(),
    [rows],
  );
  const anos = useMemo(
    () => Array.from(new Set(rows.map((r) => Number(r.data_demissao.split("-")[0])))).sort((a, b) => b - a),
    [rows],
  );

  if (checking) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canAccess) return <Navigate to="/" replace />;

  const futuras = rows.filter((r) => !r.concluido && getDiasRestantes(r) >= 0);
  const hoje = rows.filter((r) => getDiasRestantes(r) === 0);

  const toggleConcluido = async (item: HondaExclusao) => {
    const { error } = await supabase
      .from("honda_exclusoes" as any)
      .update({ concluido: !item.concluido })
      .eq("id", item.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["honda-exclusoes"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bike className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Honda Exclusões</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhamento de desligamentos programados de beneficiários Honda.
          </p>
        </div>
      </div>

      

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="importacao">Importação</TabsTrigger>
          <TabsTrigger value="futuras">Futuras</TabsTrigger>
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi icon={<Calendar className="h-4 w-4" />} label="Programadas" value={kpi.programadas} />
            <Kpi icon={<Calendar className="h-4 w-4" />} label="Do mês" value={kpi.mes} />
            <Kpi icon={<CalendarClock className="h-4 w-4" />} label="Da semana" value={kpi.semana} />
            <Kpi icon={<Bike className="h-4 w-4 text-primary" />} label="Amanhã" value={kpi.amanha} highlight />
            <Kpi icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Vencidas" value={kpi.vencidas} danger />
          </div>

          {futuras.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bike className="h-4 w-4 text-primary" /> Próximas exclusões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Dias restantes</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {futuras.slice(0, 10).map((r) => (
                      <Linha key={r.id} item={r} showMoto />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* IMPORTAÇÃO */}
        <TabsContent value="importacao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Importar arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Importe arquivos .xlsx ou .csv com as colunas:{" "}
                <code className="text-xs">TIPO OPERAÇÃO, SEQUENCIA, NOME BENEFICIARIO, CPF, DATA DEMISSÃO, MOTIVO DO DESLIGAMENTO</code>.
                Linhas vazias e registros sem CPF ou sem Data Demissão serão ignorados.
              </p>
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4 mr-2" /> Importar Arquivo
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FUTURAS */}
        <TabsContent value="futuras">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exclusões Futuras</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Dias Restantes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {futuras.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma exclusão futura.</TableCell></TableRow>
                  )}
                  {futuras.map((r) => (
                    <Linha key={r.id} item={r} showMoto onToggle={toggleConcluido} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HOJE */}
        <TabsContent value="hoje">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Exclusões do Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Dias Restantes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hoje.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma exclusão para hoje.</TableCell></TableRow>
                  )}
                  {hoje.map((r) => <Linha key={r.id} item={r} showMoto onToggle={toggleConcluido} />)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Histórico</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou CPF..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Select value={filterMes} onValueChange={setFilterMes}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Mês</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterAno} onValueChange={setFilterAno}>
                  <SelectTrigger className="w-[110px]"><SelectValue placeholder="Ano" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ano</SelectItem>
                    {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Status</SelectItem>
                    {["Programado", "Amanhã", "Hoje", "Concluído", "Atrasado"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterMotivo} onValueChange={setFilterMotivo}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="Motivo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Motivo</SelectItem>
                    {motivos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Data Demissão</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
                  )}
                  {!isLoading && filtered.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
                  )}
                  {filtered.map((r) => <Linha key={r.id} item={r} />)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ImportarHondaDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function Kpi({
  icon, label, value, highlight, danger,
}: { icon: React.ReactNode; label: string; value: number; highlight?: boolean; danger?: boolean }) {
  return (
    <Card className={cn(highlight && "border-primary/40", danger && "border-destructive/40")}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <p className={cn("text-3xl font-semibold tabular-nums mt-1", highlight && "text-primary", danger && "text-destructive")}>{value}</p>
      </CardContent>
    </Card>
  );
}
