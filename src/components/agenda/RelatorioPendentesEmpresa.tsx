import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Printer,
  Search,
  AlertTriangle,
  Clock,
  TrendingUp,
  Users,
  Filter,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  PendenteProcedimentoItem,
  RelatorioPendentesResponse,
  listarProcedimentosPendentes,
} from "@/lib/agendaCirurgicaApi";
import { printRelatorioPendentes } from "./RelatorioPendentesReport";

// AAAA-MM-DD -> DD/MM/AAAA
function toBrDate(isoDate: string): string {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function formatCNPJ(cnpj?: string | null): string {
  if (!cnpj) return "—";
  const c = cnpj.replace(/\D/g, "").padStart(14, "0");
  if (c.length !== 14) return cnpj;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

function formatDateBR(iso: string): string {
  try {
    const d = new Date(iso);
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function formatDateOnlyBR(iso: string): string {
  try {
    const d = new Date(iso);
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

const ITEMS_PER_PAGE = 50;

const STATUS_OPTIONS = [
  { value: "TODOS", label: "Todos" },
  { value: "M", label: "Marcado (M)" },
  { value: "PA", label: "Pré-agendado (PA)" },
  { value: "N", label: "Normal (N)" },
  { value: "IS", label: "Em Sala / Confirmado (IS)" },
  { value: "II", label: "Em Atendimento (II)" },
  { value: "E", label: "Executado (E)" },
  { value: "S", label: "Em Sala (S)" },
];

export function RelatorioPendentesEmpresa() {
  const { user } = useAuth();
  const today = new Date();
  const [dtInicio, setDtInicio] = useState(format(startOfMonth(today), "yyyy-MM-dd"));
  const [dtFinal, setDtFinal] = useState(format(addDays(today, 30), "yyyy-MM-dd"));
  const [cdCgc, setCdCgc] = useState("0");
  const [cdProcedimento, setCdProcedimento] = useState("0");
  const [statusList, setStatusList] = useState("TODOS");
  const [searchPatient, setSearchPatient] = useState("");
  const [page, setPage] = useState(1);

  // Filtros aplicados
  const [appliedFilters, setAppliedFilters] = useState({
    dt_inicio: toBrDate(format(startOfMonth(today), "yyyy-MM-dd")),
    dt_final: toBrDate(format(addDays(today, 30), "yyyy-MM-dd")),
    cd_cgc: "0",
    cd_procedimento: "0",
    status_list: "TODOS",
  });

  const { data, isLoading, isError, error, refetch } = useQuery<RelatorioPendentesResponse>({
    queryKey: ["relatorio-procedimentos-pendentes-empresa", appliedFilters],
    queryFn: () => listarProcedimentosPendentes(appliedFilters),
    enabled: !!appliedFilters.dt_inicio && !!appliedFilters.dt_final,
    staleTime: 60_000,
  });

  // Lista dinâmica de empresas extraída dos dados
  const empresaOptions = useMemo(() => {
    if (!data?.dados) return [];
    const map = new Map<string, string>();
    data.dados.forEach((d) => {
      if (d.cd_cgc_estipulante && d.empresa) {
        map.set(d.cd_cgc_estipulante, d.empresa);
      }
    });
    return Array.from(map.entries())
      .map(([cnpj, nome]) => ({ cnpj, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [data]);

  const handleSubmit = () => {
    if (!dtInicio || !dtFinal) {
      toast.error("Preencha as datas de início e fim.");
      return;
    }
    if (dtFinal < dtInicio) {
      toast.error("Data final deve ser igual ou posterior à data inicial.");
      return;
    }
    if (cdProcedimento !== "0" && !/^\d+$/.test(cdProcedimento)) {
      toast.error("Código do procedimento deve conter apenas números.");
      return;
    }
    setPage(1);
    setAppliedFilters({
      dt_inicio: toBrDate(dtInicio),
      dt_final: toBrDate(dtFinal),
      cd_cgc: cdCgc,
      cd_procedimento: cdProcedimento || "0",
      status_list: statusList,
    });
  };

  const handleClear = () => {
    const ini = format(startOfMonth(today), "yyyy-MM-dd");
    const fim = format(addDays(today, 30), "yyyy-MM-dd");
    setDtInicio(ini);
    setDtFinal(fim);
    setCdCgc("0");
    setCdProcedimento("0");
    setStatusList("TODOS");
    setSearchPatient("");
    setPage(1);
    setAppliedFilters({
      dt_inicio: toBrDate(ini),
      dt_final: toBrDate(fim),
      cd_cgc: "0",
      cd_procedimento: "0",
      status_list: "TODOS",
    });
  };

  // Filtragem local por nome de paciente e empresa selecionada se cdCgc for aplicado
  const filteredData = useMemo(() => {
    if (!data?.dados) return [];
    let items = data.dados;

    // Se o usuário selecionou uma empresa pelo dropdown após os dados já carregados
    if (cdCgc && cdCgc !== "0") {
      items = items.filter((i) => i.cd_cgc_estipulante === cdCgc);
    }

    if (searchPatient.trim()) {
      const q = searchPatient.toLowerCase();
      items = items.filter(
        (i) =>
          i.nm_paciente?.toLowerCase().includes(q) ||
          i.nm_social?.toLowerCase().includes(q) ||
          String(i.cd_procedimento).includes(q) ||
          i.ds_procedimento?.toLowerCase().includes(q) ||
          i.empresa?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [data, searchPatient, cdCgc]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const pagedData = filteredData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // KPIs
  const totalPendentes = data?.total ?? 0;
  const mediaDias = data?.media_dias_geral ?? "—";
  const proximoVencer = useMemo(() => {
    if (!filteredData.length) return "—";
    return Math.min(...filteredData.map((d) => d.dias_para_execucao));
  }, [filteredData]);

  const atrasadosRisco = useMemo(() => {
    return filteredData.filter((d) => d.dias_para_execucao <= 2).length;
  }, [filteredData]);

  // Exportar CSV
  const handleExportCSV = useCallback(() => {
    if (!filteredData.length) {
      toast.error("Nenhum dado para exportar.");
      return;
    }
    const headers = [
      "Paciente",
      "Nome Social",
      "Procedimento",
      "Empresa",
      "CNPJ",
      "Data Agendada",
      "Agendado em",
      "Dias p/ Execução",
      "Status",
      "Atendimento",
    ];
    const rows = filteredData.map((d) => [
      d.nm_paciente,
      d.nm_social || "",
      `${d.cd_procedimento} — ${d.ds_procedimento}`,
      d.empresa,
      d.cd_cgc_estipulante,
      formatDateBR(d.dt_agenda),
      formatDateOnlyBR(d.dt_agendamento),
      String(d.dias_para_execucao),
      d.ie_status_agenda,
      d.nr_atendimento ? String(d.nr_atendimento) : "—",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `procedimentos_pendentes_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso.");
  }, [filteredData]);

  // Exportar Excel (.xlsx)
  const handleExportExcel = useCallback(() => {
    if (!filteredData.length) {
      toast.error("Nenhum dado para exportar.");
      return;
    }
    const rows = filteredData.map((d) => ({
      Paciente: d.nm_paciente,
      "Nome Social": d.nm_social || "",
      "Cód. Procedimento": d.cd_procedimento,
      Procedimento: d.ds_procedimento,
      Empresa: d.empresa,
      CNPJ: formatCNPJ(d.cd_cgc_estipulante),
      "Data Agendada": formatDateBR(d.dt_agenda),
      "Agendado em": formatDateOnlyBR(d.dt_agendamento),
      "Dias p/ Execução": d.dias_para_execucao,
      Status: d.ie_status_agenda,
      Atendimento: d.nr_atendimento ?? "—",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Pendentes");
    XLSX.writeFile(wb, `procedimentos_pendentes_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
    toast.success("Excel exportado com sucesso.");
  }, [filteredData]);

  // Imprimir
  const handlePrint = () => {
    if (!filteredData.length) {
      toast.error("Nenhum dado para imprimir.");
      return;
    }
    const empresaSelecionada =
      cdCgc !== "0" ? empresaOptions.find((e) => e.cnpj === cdCgc)?.nome : undefined;
    const statusLabel = STATUS_OPTIONS.find((s) => s.value === appliedFilters.status_list)?.label;

    printRelatorioPendentes({
      itens: filteredData,
      filtros: {
        dt_inicio: appliedFilters.dt_inicio,
        dt_final: appliedFilters.dt_final,
        empresa: empresaSelecionada,
        cd_cgc: appliedFilters.cd_cgc,
        cd_procedimento: appliedFilters.cd_procedimento,
        status_label: statusLabel,
        paciente: searchPatient.trim() || undefined,
      },
      kpis: {
        total: totalPendentes,
        media_dias: String(mediaDias),
        proximo_vencer: proximoVencer,
        em_risco: atrasadosRisco,
      },
      usuario: user?.email,
    });
  };

  const diasBadgeClass = (dias: number) => {
    if (dias <= 2) return "bg-destructive text-destructive-foreground hover:bg-destructive/90";
    if (dias <= 7) return "bg-amber-500 text-white hover:bg-amber-600";
    return "bg-emerald-600 text-white hover:bg-emerald-700";
  };

  return (
    <div className="space-y-4">
      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="dt-inicio" className="text-xs text-muted-foreground">
                Data início
              </Label>
              <Input
                id="dt-inicio"
                type="date"
                value={dtInicio}
                onChange={(e) => setDtInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt-final" className="text-xs text-muted-foreground">
                Data final
              </Label>
              <Input
                id="dt-final"
                type="date"
                value={dtFinal}
                onChange={(e) => setDtFinal(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Empresa</Label>
              <Select value={cdCgc} onValueChange={setCdCgc}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="0">Todas</SelectItem>
                  {empresaOptions.map((e) => (
                    <SelectItem key={e.cnpj} value={e.cnpj}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-proc" className="text-xs text-muted-foreground">
                Procedimento
              </Label>
              <Input
                id="cd-proc"
                placeholder="Código (ex: 10196)"
                value={cdProcedimento === "0" ? "" : cdProcedimento}
                onChange={(e) => setCdProcedimento(e.target.value || "0")}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusList} onValueChange={setStatusList}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} className="flex-1 gap-1">
                <Filter className="h-4 w-4" /> Filtrar
              </Button>
              <Button variant="outline" onClick={handleClear} className="gap-1">
                <X className="h-4 w-4" /> Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Total Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-16" /> : totalPendentes}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Média Histórica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-24" /> : mediaDias}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Próximo a Vencer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : proximoVencer === "—" ? (
                "—"
              ) : (
                `${proximoVencer} dias`
              )}
            </p>
          </CardContent>
        </Card>

        <Card className={cn("border border-border/60", atrasadosRisco > 0 && "border-destructive/30 bg-destructive/5")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Em Risco (≤ 2d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={cn(
                "text-2xl font-bold",
                atrasadosRisco > 0 ? "text-destructive" : "text-foreground"
              )}
            >
              {isLoading ? <Skeleton className="h-8 w-16" /> : atrasadosRisco}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Warning se limite de 1000 atingido */}
      {data && data.total >= 1000 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span>Limite de 1000 linhas atingido pela API. Refine os filtros para resultados mais específicos.</span>
        </div>
      )}

      {/* Table Toolbar & Content */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-3 border-b">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente ou procedimento..."
              value={searchPatient}
              onChange={(e) => {
                setSearchPatient(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1.5 h-9">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5 h-9">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 h-9">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-muted-foreground">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
              <p className="font-medium text-destructive">Erro ao carregar relatório de procedimentos</p>
              <p className="text-sm mt-1">{(error as Error)?.message}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : pagedData.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nenhum procedimento pendente para os filtros selecionados.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleClear}>
                Limpar filtros
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Data Agendada</TableHead>
                    <TableHead>Agendado em</TableHead>
                    <TableHead className="text-center">Dias p/ Execução</TableHead>
                    <TableHead className="text-center">Atendimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedData.map((item, idx) => (
                    <TableRow key={`${item.cd_pessoa_fisica}-${item.cd_procedimento}-${idx}`}>
                      <TableCell className="font-medium">
                        {item.nm_social ? (
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground truncate">{item.nm_social}</span>
                            <span className="text-[10px] text-muted-foreground font-normal truncate">
                              Nome civil: {item.nm_paciente}
                            </span>
                          </div>
                        ) : (
                          <div className="truncate">{item.nm_paciente}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <span className="font-semibold">{item.cd_procedimento}</span>
                        <span className="text-muted-foreground"> — {item.ds_procedimento}</span>
                      </TableCell>
                      <TableCell>{item.empresa || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCNPJ(item.cd_cgc_estipulante)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateBR(item.dt_agenda)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateOnlyBR(item.dt_agendamento)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={diasBadgeClass(item.dias_para_execucao)}>
                          {item.dias_para_execucao} dias
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{item.nr_atendimento ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t text-sm">
                  <p className="text-muted-foreground">
                    Mostrando {(page - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(page * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      Pág. {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
