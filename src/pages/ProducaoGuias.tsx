import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ClipboardList, Download, RefreshCw, Search, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchEmpresasProducaoGuias, fetchProducaoGuias } from "@/lib/producaoGuiasApi";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--chart-2))"];
const fmt = (n: number) => (n ?? 0).toLocaleString("pt-BR");
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const brData = (s: string) => (s ? s.split("-").reverse().join("/") : "");

function mesRange(offset: number) {
  const now = new Date();
  const ini = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const fim = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { ini: iso(ini), fim: iso(fim) };
}

type SortKey = "USUARIO" | "QTD" | "PACIENTES" | string;

export default function ProducaoGuias() {
  const inicial = mesRange(0);
  const [ini, setIni] = useState(inicial.ini);
  const [fim, setFim] = useState(inicial.fim);
  const [busca, setBusca] = useState("");
  const [tarefaFiltro, setTarefaFiltro] = useState("todas");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "QTD", dir: "desc" });
  const [page, setPage] = useState(0);
  const PAGE = 20;

  const [empresa, setEmpresa] = useState("");
  const [empOpen, setEmpOpen] = useState(false);
  const { data: empresas = [], isLoading: loadingEmpresas } = useQuery({
    queryKey: ["producao-guias-empresas"],
    queryFn: fetchEmpresasProducaoGuias,
    staleTime: 60 * 60 * 1000,
  });

  const periodoOk = !!ini && !!fim && ini <= fim;
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["producao-guias", ini, fim, empresa],
    queryFn: () => fetchProducaoGuias(ini, fim, empresa),
    enabled: periodoOk,
  });

  const tarefas = data?.TAREFAS ?? [];

  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data?.USUARIOS ?? [])
      .map((u) => {
        const porTarefa: Record<string, { qtd: number; pac: number }> = {};
        u.TAREFAS.forEach((t) => (porTarefa[t.TAREFA] = { qtd: t.QTD, pac: t.PACIENTES }));
        const qtd = tarefaFiltro === "todas" ? u.TOTAL.QTD : porTarefa[tarefaFiltro]?.qtd ?? 0;
        const pac = tarefaFiltro === "todas" ? u.TOTAL.PACIENTES : porTarefa[tarefaFiltro]?.pac ?? 0;
        return { usuario: u.USUARIO, porTarefa, QTD: qtd, PACIENTES: pac, perc: u.TOTAL.PERC_QTD };
      })
      .filter((l) => (!q || l.usuario.toLowerCase().includes(q)) && (tarefaFiltro === "todas" || l.QTD > 0));
  }, [data, busca, tarefaFiltro]);

  const ordenadas = useMemo(() => {
    const arr = [...linhas];
    const mult = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sort.key === "USUARIO") return a.usuario.localeCompare(b.usuario, "pt-BR") * mult;
      if (sort.key === "QTD") return (a.QTD - b.QTD) * mult;
      if (sort.key === "PACIENTES") return (a.PACIENTES - b.PACIENTES) * mult;
      return ((a.porTarefa[sort.key]?.qtd ?? 0) - (b.porTarefa[sort.key]?.qtd ?? 0)) * mult;
    });
    return arr;
  }, [linhas, sort]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / PAGE));
  const pagina = Math.min(page, totalPaginas - 1);
  const visiveis = ordenadas.slice(pagina * PAGE, pagina * PAGE + PAGE);

  const top10 = useMemo(
    () =>
      [...linhas]
        .sort((a, b) => b.QTD - a.QTD)
        .slice(0, 10)
        .map((l) => ({
          nome: l.usuario.length > 22 ? l.usuario.slice(0, 21) + "…" : l.usuario,
          ...Object.fromEntries(tarefas.map((t) => [t, l.porTarefa[t]?.qtd ?? 0])),
        })),
    [linhas, tarefas],
  );

  const porTarefaChart = (data?.TOTAIS.POR_TAREFA ?? []).map((t) => ({ tarefa: t.TAREFA, Guias: t.QTD, Pacientes: t.PACIENTES }));

  const toggleSort = (key: SortKey) => {
    setPage(0);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "USUARIO" ? "asc" : "desc" }));
  };
  const SortIcon = ({ k }: { k: SortKey }) =>
    sort.key !== k ? <ArrowUpDown className="h-3 w-3 opacity-40" /> : sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;

  const exportar = () => {
    const rows = ordenadas.map((l) => {
      const r: Record<string, string | number> = { Usuário: l.usuario };
      tarefas.forEach((t) => {
        r[`${t} (guias)`] = l.porTarefa[t]?.qtd ?? 0;
        r[`${t} (pacientes)`] = l.porTarefa[t]?.pac ?? 0;
      });
      r["Total guias"] = l.QTD;
      r["Total pacientes"] = l.PACIENTES;
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produção de guias");
    XLSX.writeFile(wb, `producao-guias_${empresa ? empresa.slice(0, 40).replace(/[^\w]+/g, "_") + "_" : ""}${ini}_${fim}.xlsx`);
  };

  const setMes = (offset: number) => {
    const r = mesRange(offset);
    setIni(r.ini);
    setFim(r.fim);
    setPage(0);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2 mb-1">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> Voltar ao início
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Produção de Guias · Ambulatório</h1>
              <p className="text-sm text-muted-foreground">Guias e pacientes por usuário e tipo de tarefa, direto da API da operadora</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data inicial</label>
          <Input type="date" value={ini} onChange={(e) => { setIni(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Data final</label>
          <Input type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPage(0); }} className="w-40" />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMes(0)}>Mês atual</Button>
          <Button variant="outline" size="sm" onClick={() => setMes(-1)}>Mês anterior</Button>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Empresa</label>
          <Popover open={empOpen} onOpenChange={setEmpOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-72 justify-between font-normal">
                <span className="truncate">{empresa || "Todas as empresas"}</span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar empresa..." />
                <CommandList>
                  <CommandEmpty>{loadingEmpresas ? "Carregando..." : "Nenhuma empresa."}</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="__todas__" onSelect={() => { setEmpresa(""); setEmpOpen(false); setPage(0); }}>
                      <Check className={`h-4 w-4 mr-2 ${!empresa ? "opacity-100" : "opacity-0"}`} /> Todas as empresas
                    </CommandItem>
                    {empresas.map((e) => (
                      <CommandItem key={e} value={e} onSelect={() => { setEmpresa(e); setEmpOpen(false); setPage(0); }}>
                        <Check className={`h-4 w-4 mr-2 ${empresa === e ? "opacity-100" : "opacity-0"}`} /> {e}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tarefa</label>
          <Select value={tarefaFiltro} onValueChange={(v) => { setTarefaFiltro(v); setPage(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {tarefas.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={!periodoOk || isFetching} className="gap-1">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button size="sm" onClick={exportar} disabled={!ordenadas.length} className="gap-1">
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </Card>

      {!periodoOk && <Card className="p-4 text-sm text-destructive">Informe um período válido (data inicial menor ou igual à final).</Card>}
      {error && <Card className="p-4 text-sm text-destructive">Não foi possível consultar a API: {(error as Error).message}</Card>}

      {isLoading && periodoOk ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Consultando a API da operadora… períodos longos podem levar até 30 segundos.</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      ) : data ? (
        <>
          <p className="text-xs text-muted-foreground">
            Período: {brData(data.PERIODO.DT_INICIO)} a {brData(data.PERIODO.DT_FIM)} · {fmt(data.USUARIOS.length)} usuários
          </p>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Total de guias</div>
              <div className="text-2xl font-bold mt-1">{fmt(data.TOTAIS.QTD)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-muted-foreground">Pacientes atendidos</div>
              <div className="text-2xl font-bold mt-1">{fmt(data.TOTAIS.PACIENTES)}</div>
            </Card>
            {data.TOTAIS.POR_TAREFA.map((t, i) => (
              <Card key={t.TAREFA} className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: CORES[i % CORES.length] }} />
                  {t.TAREFA}
                </div>
                <div className="text-2xl font-bold mt-1">{fmt(t.QTD)}</div>
                <div className="text-xs text-muted-foreground">{fmt(t.PACIENTES)} pacientes</div>
              </Card>
            ))}
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">Guias e pacientes por tarefa</div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={porTarefaChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="tarefa" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={fmt} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="Guias" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Pacientes" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Top 10 usuários por volume de guias
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={top10} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="nome" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    {tarefas.map((t, i) => (
                      <Bar key={t} dataKey={t} stackId="a" fill={CORES[i % CORES.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Tabela */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm font-semibold">Produção por usuário</div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPage(0); }} placeholder="Buscar usuário" className="pl-8 w-64" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="cursor-pointer" onClick={() => toggleSort("USUARIO")}>
                      <span className="inline-flex items-center gap-1">Usuário <SortIcon k="USUARIO" /></span>
                    </TableHead>
                    {tarefas.map((t) => (
                      <TableHead key={t} className="text-right cursor-pointer" onClick={() => toggleSort(t)}>
                        <span className="inline-flex items-center gap-1">{t} <SortIcon k={t} /></span>
                      </TableHead>
                    ))}
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("QTD")}>
                      <span className="inline-flex items-center gap-1">Total guias <SortIcon k="QTD" /></span>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer" onClick={() => toggleSort("PACIENTES")}>
                      <span className="inline-flex items-center gap-1">Pacientes <SortIcon k="PACIENTES" /></span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visiveis.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={tarefas.length + 3} className="text-center text-muted-foreground py-8">
                        Nenhum usuário encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visiveis.map((l) => (
                      <TableRow key={l.usuario}>
                        <TableCell className="font-medium">{l.usuario}</TableCell>
                        {tarefas.map((t) => (
                          <TableCell key={t} className="text-right tabular-nums">{fmt(l.porTarefa[t]?.qtd ?? 0)}</TableCell>
                        ))}
                        <TableCell className="text-right tabular-nums font-semibold">{fmt(l.QTD)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(l.PACIENTES)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmt(ordenadas.length)} usuários</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPage(pagina - 1)}>Anterior</Button>
                <span>{pagina + 1} / {totalPaginas}</span>
                <Button variant="outline" size="sm" disabled={pagina >= totalPaginas - 1} onClick={() => setPage(pagina + 1)}>Próxima</Button>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
