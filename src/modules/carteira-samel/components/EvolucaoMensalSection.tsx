import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Filter,
  Minus,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEmpresasCarteira } from "../context/EmpresasContext";
import {
  agruparPorPeriodo,
  fmtMoeda,
  fmtMoedaSinal,
  fmtPct,
  fmtPctSinal,
  labelMeta,
  labelPeriodo,
  LinhaEvolucao,
  META_PADRAO,
  calcular,
  parseColagem,
  toLinha,
} from "../lib/evolucao-mensal";
import {
  useCarteiraConfig,
  useDeleteLancamento,
  useEvolucaoMensal,
  useUpsertLancamento,
} from "../hooks/useEvolucaoMensal";
import { ConfigCarteiraDialog } from "./ConfigCarteiraDialog";

const RANGES = [
  { v: "3", label: "Últimos 3 meses" },
  { v: "6", label: "Últimos 6 meses" },
  { v: "12", label: "Últimos 12 meses" },
  { v: "all", label: "Todo o histórico" },
];

function slugify(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Paleta por empresa (consistente entre chip e linhas do gráfico)
const CHIP_GRUPO = "hsl(152 60% 40%)";
const PALETA_EMPRESAS = [
  "hsl(217 91% 60%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(0 72% 55%)",
  "hsl(190 80% 45%)",
  "hsl(45 90% 40%)",
];

function corEmpresa(nome: string) {
  const s = slugify(nome);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETA_EMPRESAS[h % PALETA_EMPRESAS.length];
}

export function EvolucaoMensalSection() {
  const { ativas } = useEmpresasCarteira();
  const { data: lancamentos = [], isLoading } = useEvolucaoMensal();
  const del = useDeleteLancamento();
  const [searchParams, setSearchParams] = useSearchParams();

  const [empresasSel, setEmpresasSel] = useState<string[]>([]);
  const [range, setRange] = useState("12");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [loteAberto, setLoteAberto] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);
  const { data: config = {} } = useCarteiraConfig();

  // Visão vem da URL (?empresa=grupo | todas | slug-da-empresa)
  const paramEmpresa = searchParams.get("empresa") || "grupo";
  const visao = useMemo(() => {
    if (paramEmpresa === "grupo") return "__grupo__";
    if (paramEmpresa === "todas") return "__todas__";
    const match = ativas.find((e) => slugify(e.nome) === paramEmpresa || e.id === paramEmpresa);
    return match ? match.id : "__grupo__";
  }, [paramEmpresa, ativas]);

  const setVisao = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === "__grupo__") next.set("empresa", "grupo");
    else if (v === "__todas__") next.set("empresa", "todas");
    else next.set("empresa", slugify(ativas.find((e) => e.id === v)?.nome || v));
    setSearchParams(next, { replace: true });
  };

  const linhas = useMemo(() => lancamentos.map(toLinha), [lancamentos]);

  const periodosDisponiveis = useMemo(
    () => [...new Set(linhas.map((l) => l.periodo))].sort(),
    [linhas],
  );

  const periodosFiltrados = useMemo(() => {
    if (range === "all") return periodosDisponiveis;
    return periodosDisponiveis.slice(-Number(range));
  }, [periodosDisponiveis, range]);

  const linhasFiltradas = useMemo(
    () =>
      linhas.filter(
        (l) =>
          periodosFiltrados.includes(l.periodo) &&
          (empresasSel.length === 0 || empresasSel.includes(l.empresaId)),
      ),
    [linhas, periodosFiltrados, empresasSel],
  );

  // Série do gráfico: consolidado do grupo/todas ou de uma empresa
  const serie = useMemo(() => {
    const base =
      visao === "__grupo__" || visao === "__todas__"
        ? linhasFiltradas
        : linhasFiltradas.filter((l) => l.empresaId === visao);
    return agruparPorPeriodo(base);
  }, [linhasFiltradas, visao]);

  const consolidadoTodos = useMemo(() => agruparPorPeriodo(linhasFiltradas), [linhasFiltradas]);
  const atual = consolidadoTodos[consolidadoTodos.length - 1] || null;
  const anterior = consolidadoTodos[consolidadoTodos.length - 2] || null;
  const variacao = atual && anterior ? atual.sinistralidade - anterior.sinistralidade : null;

  const mostrarTotais = visao === "__todas__";

  const tabela = useMemo(() => {
    if (visao === "__grupo__") {
      return [...consolidadoTodos].sort((a, b) => b.periodo.localeCompare(a.periodo));
    }
    const base =
      visao === "__todas__" ? linhasFiltradas : linhasFiltradas.filter((l) => l.empresaId === visao);
    return [...base].sort(
      (a, b) => b.periodo.localeCompare(a.periodo) || a.empresaNome.localeCompare(b.empresaNome),
    );
  }, [linhasFiltradas, consolidadoTodos, visao]);

  const totaisPorPeriodo = useMemo(() => {
    const map = new Map<string, LinhaEvolucao>();
    consolidadoTodos.forEach((c) => map.set(c.periodo, c));
    return map;
  }, [consolidadoTodos]);

  // Meta (break even) vigente na visão atual
  const metaVisao = useMemo(() => {
    if (visao !== "__grupo__" && visao !== "__todas__") {
      return config[visao]?.meta_sinistralidade ?? serie[serie.length - 1]?.meta ?? META_PADRAO;
    }
    return serie[serie.length - 1]?.meta ?? META_PADRAO;
  }, [config, visao, serie]);

  const temInCompany = useMemo(() => tabela.some((l) => l.inCompanyTotal > 0), [tabela]);

  const chartData = serie.map((s) => ({
    periodo: labelPeriodo(s.periodo),
    premioTotal: Number(s.premioTotal.toFixed(2)),
    sinistro: Number(s.sinistro.toFixed(2)),
    sinistroTotal: Number(s.sinistroTotal.toFixed(2)),
    inCompany: Number(s.inCompanyTotal.toFixed(2)),
    sinistralidade: Number((s.sinistralidade * 100).toFixed(2)),
  }));

  // Empresas presentes nos dados filtrados (para visão "Todas")
  const empresasNoGrafico = useMemo(() => {
    const map = new Map<string, string>();
    linhasFiltradas.forEach((l) => map.set(l.empresaId, l.empresaNome));
    return [...map.entries()].map(([id, nome]) => ({ id, nome }));
  }, [linhasFiltradas]);

  // Série multi-empresa: uma linha de sinistralidade por empresa
  const chartDataTodas = useMemo(() => {
    const periodos = [...new Set(linhasFiltradas.map((l) => l.periodo))].sort();
    return periodos.map((p) => {
      const row: any = { periodo: labelPeriodo(p) };
      const cons = totaisPorPeriodo.get(p);
      row.premioTotal = cons ? Number(cons.premioTotal.toFixed(2)) : 0;
      empresasNoGrafico.forEach((e) => {
        const l = linhasFiltradas.find((x) => x.periodo === p && x.empresaId === e.id);
        row[`sin_${e.id}`] = l ? Number((l.sinistralidade * 100).toFixed(2)) : null;
      });
      return row;
    });
  }, [linhasFiltradas, empresasNoGrafico, totaisPorPeriodo]);

  const nomeVisao =
    visao === "__grupo__"
      ? "Grupo (consolidado)"
      : visao === "__todas__"
      ? "Todas as empresas"
      : ativas.find((e) => e.id === visao)?.nome || "—";

  const corVisao = visao === "__grupo__" ? CHIP_GRUPO : corEmpresa(nomeVisao);

  const resumoContexto = useMemo(() => {
    if (!atual) return null;
    return anterior
      ? `${labelPeriodo(atual.periodo)} vs ${labelPeriodo(anterior.periodo)}`
      : labelPeriodo(atual.periodo);
  }, [atual, anterior]);



  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={TrendingUp}
          label="Sinistralidade do mês"
          value={atual ? fmtPct(atual.sinistralidade) : "—"}
          hint={atual ? `Grupo · ${labelPeriodo(atual.periodo)}` : "Sem lançamentos"}
        />
        <Kpi
          icon={variacao == null ? Minus : variacao < 0 ? ArrowDownRight : ArrowUpRight}
          label="Variação vs. mês anterior"
          value={variacao == null ? "—" : `${variacao > 0 ? "+" : ""}${(variacao * 100).toFixed(1).replace(".", ",")} p.p.`}
          hint={anterior ? `${labelPeriodo(anterior.periodo)} → ${labelPeriodo(atual!.periodo)}` : "—"}
          tone={variacao == null ? "neutro" : variacao < 0 ? "bom" : "ruim"}
        />
        <Kpi
          icon={Wallet}
          label="Aporte financeiro do mês"
          value={atual ? fmtMoedaSinal(atual.aporte) : "—"}
          hint={
            atual
              ? atual.aporte > 0
                ? "A favor da operadora"
                : atual.aporte < 0
                ? "Crédito para a empresa"
                : "Equilibrado"
              : "—"
          }
          tone={atual ? (atual.aporte > 0 ? "ruim" : "bom") : "neutro"}
        />
        <Kpi
          icon={Building2}
          label="Prêmio total do mês"
          value={atual ? fmtMoeda(atual.premioTotal) : "—"}
          hint={atual ? `${labelMeta(atual.meta)}: ${fmtMoeda(atual.beMeta)}` : "—"}
        />
      </div>

      {/* Filtros (sticky) */}
      <Card className="sticky top-2 z-30 p-3 flex flex-wrap items-center gap-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shrink-0"
          style={{ backgroundColor: corVisao }}
        >
          <Building2 className="h-3.5 w-3.5" />
          {nomeVisao}
        </span>
        {resumoContexto && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Mostrando: <span className="font-medium text-foreground">{nomeVisao}</span> · {resumoContexto}
          </span>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-3.5 w-3.5" />
              Empresas
              {empresasSel.length > 0 && <Badge variant="secondary">{empresasSel.length}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <div className="max-h-72 overflow-y-auto p-2 space-y-1">
              {ativas.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={empresasSel.includes(e.id)}
                    onCheckedChange={(c) =>
                      setEmpresasSel((prev) =>
                        c ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                      )
                    }
                  />
                  <span className="truncate">{e.nome}</span>
                </label>
              ))}
            </div>
            {empresasSel.length > 0 && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setEmpresasSel([])}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.v} value={r.v}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={visao} onValueChange={setVisao}>
          <SelectTrigger className="h-9 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__grupo__">Grupo (consolidado)</SelectItem>
            <SelectItem value="__todas__">Todas (visão completa)</SelectItem>
            {ativas.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfigAberto(true)}>
            <Settings2 className="h-3.5 w-3.5 mr-1" /> Configurar meta
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLoteAberto(true)}>
            Importar em lote
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditando(null);
              setDialogAberto(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo lançamento
          </Button>
        </div>
      </Card>

      {/* Gráfico */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <span className="text-muted-foreground">Evolução mensal —</span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-bold"
              style={{
                color: corVisao,
                backgroundColor: `color-mix(in srgb, ${corVisao} 15%, transparent)`,
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corVisao }} />
              {nomeVisao}
            </span>
          </h3>
          <span className="text-xs text-muted-foreground">
            Linha tracejada = Break Even {fmtPct(metaVisao, 0)}
            {temInCompany && " · Sinistro total inclui custos in company"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <div
            style={{
              minWidth: Math.max(
                560,
                (mostrarTotais ? chartDataTodas.length : chartData.length) * 90,
              ),
            }}
            className="h-[320px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={mostrarTotais ? chartDataTodas : chartData}
                margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  yAxisId="v"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="p"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: any) =>
                    String(name).includes("%")
                      ? [`${Number(value).toFixed(2).replace(".", ",")}%`, name]
                      : [fmtMoeda(Number(value)), name]
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  yAxisId="p"
                  y={Number((metaVisao * 100).toFixed(2))}
                  strokeDasharray="5 5"
                  stroke="hsl(var(--destructive))"
                  label={{ value: labelMeta(metaVisao), position: "right", fontSize: 10 }}
                />
                <Line
                  yAxisId="v"
                  type="monotone"
                  dataKey="premioTotal"
                  name="Prêmio Total"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray={mostrarTotais ? "6 4" : undefined}
                  dot={{ r: 3 }}
                />
                {mostrarTotais ? (
                  empresasNoGrafico.map((e) => (
                    <Line
                      key={e.id}
                      yAxisId="p"
                      type="monotone"
                      connectNulls
                      dataKey={`sin_${e.id}`}
                      name={`${e.nome} — Sinistralidade %`}
                      stroke={corEmpresa(e.nome)}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  ))
                ) : (
                  <>
                    <Line
                      yAxisId="v"
                      type="monotone"
                      dataKey="sinistro"
                      name={temInCompany ? "Sinistro (operadora)" : "Sinistro"}
                      stroke="hsl(var(--warning, 38 92% 50%))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    {temInCompany && (
                      <Line
                        yAxisId="v"
                        type="monotone"
                        dataKey="sinistroTotal"
                        name="Sinistro Total (com in company)"
                        stroke="hsl(25 90% 45%)"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={{ r: 3 }}
                      />
                    )}
                    <Line
                      yAxisId="p"
                      type="monotone"
                      dataKey="sinistralidade"
                      name="Sinistralidade %"
                      stroke="hsl(var(--destructive))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Card>


      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Período</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-right">Prêmio Empresa</th>
                <th className="px-3 py-2 text-right">Prêmio Continuidade</th>
                <th className="px-3 py-2 text-right">Prêmio Total</th>
                <th className="px-3 py-2 text-right">{temInCompany ? "Sinistro (operadora)" : "Sinistro"}</th>
                {temInCompany && <th className="px-3 py-2 text-right">In company</th>}
                {temInCompany && <th className="px-3 py-2 text-right">Sinistro Total</th>}
                <th className="px-3 py-2 text-right">Sinistralidade</th>
                <th className="px-3 py-2 text-right">BE Meta</th>
                <th className="px-3 py-2 text-right">Distorção</th>
                <th className="px-3 py-2 text-right">Aporte Financeiro</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={temInCompany ? 13 : 11} className="px-3 py-6 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && tabela.length === 0 && (
                <tr>
                  <td colSpan={temInCompany ? 13 : 11} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum lançamento no período selecionado.
                  </td>
                </tr>
              )}
              {tabela.map((l, i) => {
                const primeiroDoPeriodo = i === 0 || tabela[i - 1].periodo !== l.periodo;
                const total = totaisPorPeriodo.get(l.periodo);
                const isGrupoRow = l.empresaId === "__grupo__";
                return (
                  <>
                    {mostrarTotais && primeiroDoPeriodo && total && (
                      <tr key={`t-${l.periodo}`} className="border-t bg-primary/5 font-semibold">
                        <td className="px-3 py-2">{labelPeriodo(l.periodo)}</td>
                        <td className="px-3 py-2">Grupo (consolidado)</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.premioEmpresa)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.premioContinuidade)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.premioTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.sinistro)}</td>
                        {temInCompany && (
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.inCompanyTotal)}</td>
                        )}
                        {temInCompany && (
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.sinistroTotal)}</td>
                        )}
                        <td className="px-3 py-2 text-right tabular-nums">{fmtPct(total.sinistralidade)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(total.beMeta)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", corValor(total.distorcao))}>
                          {fmtPctSinal(total.distorcao)}
                        </td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", corValor(total.aporte))}>
                          {fmtMoedaSinal(total.aporte)}
                        </td>
                        <td />
                      </tr>
                    )}
                    <tr
                      key={l.empresaId + l.periodo}
                      className={cn(
                        "border-t hover:bg-muted/30",
                        isGrupoRow && "bg-primary/5 font-semibold",
                      )}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{labelPeriodo(l.periodo)}</td>
                      <td className="px-3 py-2 font-medium">{l.empresaNome}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.premioEmpresa)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.premioContinuidade)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.premioTotal)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.sinistro)}</td>
                      {temInCompany && (
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.inCompanyTotal)}</td>
                      )}
                      {temInCompany && (
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.sinistroTotal)}</td>
                      )}
                      <td className="px-3 py-2 text-right tabular-nums">{fmtPct(l.sinistralidade)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoeda(l.beMeta)}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", corValor(l.distorcao))}>
                        {fmtPctSinal(l.distorcao)}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", corValor(l.aporte))}>
                        {fmtMoedaSinal(l.aporte)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {!isGrupoRow && (
                          <>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                const orig = lancamentos.find(
                                  (x) => x.empresa_id === l.empresaId && x.periodo === l.periodo,
                                );
                                setEditando(orig);
                                setDialogAberto(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                const orig = lancamentos.find(
                                  (x) => x.empresa_id === l.empresaId && x.periodo === l.periodo,
                                );
                                if (orig) del.mutate(orig.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden divide-y">
          {tabela.map((l) => (
            <div key={l.empresaId + l.periodo} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{l.empresaNome}</span>
                <Badge variant="outline">{labelPeriodo(l.periodo)}</Badge>
              </div>
              <Row label="Prêmio total" value={fmtMoeda(l.premioTotal)} />
              <Row label="Sinistro" value={fmtMoeda(l.sinistro)} />
              <Row label="Sinistralidade" value={fmtPct(l.sinistralidade)} />
              <Row label="BE 70%" value={fmtMoeda(l.be70)} />
              <Row label="Distorção" value={fmtPctSinal(l.distorcao)} className={corValor(l.distorcao)} />
              <Row label="Aporte" value={fmtMoedaSinal(l.aporte)} className={corValor(l.aporte)} />
            </div>
          ))}
          {tabela.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum lançamento.</p>
          )}
        </div>
      </Card>

      <LancamentoDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        registro={editando}
        empresas={ativas}
      />
      <LoteDialog open={loteAberto} onOpenChange={setLoteAberto} empresas={ativas} />
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-medium", className)}>{value}</span>
    </div>
  );
}

function corValor(v: number) {
  if (v > 0.0001) return "text-destructive";
  if (v < -0.0001) return "text-success";
  return "";
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutro",
}: {
  icon: any;
  label: string;
  value: string;
  hint?: string;
  tone?: "bom" | "ruim" | "neutro";
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={cn(
            "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ring-1 ring-border/60",
            tone === "bom" ? "bg-success/10" : tone === "ruim" ? "bg-destructive/10" : "bg-primary/10",
          )}
        >
          <Icon
            className={cn(
              "h-5 w-5",
              tone === "bom" ? "text-success" : tone === "ruim" ? "text-destructive" : "text-primary",
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
          <p
            className={cn(
              "text-xl font-bold tracking-tight tabular-nums",
              tone === "bom" ? "text-success" : tone === "ruim" ? "text-destructive" : "text-foreground",
            )}
          >
            {value}
          </p>
          {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function LancamentoDialog({
  open,
  onOpenChange,
  registro,
  empresas,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registro: any | null;
  empresas: { id: string; nome: string }[];
}) {
  const upsert = useUpsertLancamento();
  const [empresaId, setEmpresaId] = useState("");
  const [mes, setMes] = useState("");
  const [pe, setPe] = useState("0");
  const [pc, setPc] = useState("0");
  const [sin, setSin] = useState("0");

  const key = registro?.id || "novo";
  const [lastKey, setLastKey] = useState<string>("");
  if (open && lastKey !== key) {
    setLastKey(key);
    setEmpresaId(registro?.empresa_id || "");
    setMes(registro?.periodo ? registro.periodo.slice(0, 7) : new Date().toISOString().slice(0, 7));
    setPe(String(registro?.premio_empresa ?? 0));
    setPc(String(registro?.premio_continuidade ?? 0));
    setSin(String(registro?.sinistro ?? 0));
  }

  const calc = calcular(Number(pe) || 0, Number(pc) || 0, Number(sin) || 0);

  const salvar = async () => {
    if (!empresaId || !mes) {
      toast.error("Selecione empresa e período");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: registro?.id,
        empresa_id: empresaId,
        empresa_nome: empresas.find((e) => e.id === empresaId)?.nome || "",
        periodo: `${mes}-01`,
        premio_empresa: Number(pe) || 0,
        premio_continuidade: Number(pc) || 0,
        sinistro: Number(sin) || 0,
      });
      toast.success("Lançamento salvo");
      onOpenChange(false);
      setLastKey("");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{registro ? "Editar lançamento" : "Novo lançamento mensal"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Período</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Prêmio Empresa (R$)</Label>
              <Input type="number" step="0.01" value={pe} onChange={(e) => setPe(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Prêmio Continuidade (R$)</Label>
              <Input type="number" step="0.01" value={pc} onChange={(e) => setPc(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sinistro (R$)</Label>
              <Input type="number" step="0.01" value={sin} onChange={(e) => setSin(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
              Calculado automaticamente
            </p>
            <Row label="Prêmio Total" value={fmtMoeda(calc.premioTotal)} />
            <Row label="Sinistralidade" value={fmtPct(calc.sinistralidade)} />
            <Row label="BE 70%" value={fmtMoeda(calc.be70)} />
            <Row label="Distorção" value={fmtPctSinal(calc.distorcao)} className={corValor(calc.distorcao)} />
            <Row
              label="Aporte Financeiro"
              value={fmtMoedaSinal(calc.aporte)}
              className={corValor(calc.aporte)}
            />
            <p className="text-[11px] text-muted-foreground pt-1">
              {calc.aporte > 0
                ? "Aporte a favor da operadora."
                : calc.aporte < 0
                ? "Crédito para a empresa."
                : "Contrato em equilíbrio."}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={upsert.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LoteDialog({
  open,
  onOpenChange,
  empresas,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  empresas: { id: string; nome: string }[];
}) {
  const upsert = useUpsertLancamento();
  const [texto, setTexto] = useState("");

  const parsed = useMemo(() => {
    return parseColagem(texto).map((r) => {
      const emp = empresas.find(
        (e) => e.nome.toLowerCase().trim() === r.empresa.toLowerCase().trim(),
      );
      return { ...r, empresaId: emp?.id, empresaNome: emp?.nome };
    });
  }, [texto, empresas]);

  const validos = parsed.filter((p) => p.empresaId);

  const importar = async () => {
    if (!validos.length) {
      toast.error("Nenhuma linha válida");
      return;
    }
    try {
      await upsert.mutateAsync(
        validos.map((v) => ({
          empresa_id: v.empresaId!,
          empresa_nome: v.empresaNome!,
          periodo: v.periodo,
          premio_empresa: v.premioEmpresa,
          premio_continuidade: v.premioContinuidade,
          sinistro: v.sinistro,
        })),
      );
      toast.success(`${validos.length} lançamento(s) importado(s)`);
      setTexto("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao importar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar lançamentos em lote</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Cole uma linha por empresa/mês, separada por tabulação ou ponto e vírgula:
          <br />
          <code>Empresa; mai/26; 120000,00; 15000,00; 90000,00</code> (Empresa; Período; Prêmio Empresa;
          Prêmio Continuidade; Sinistro)
        </p>
        <Textarea
          rows={8}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="TEC TOY; abr/26; 300000; 20000; 250000"
          className="font-mono text-xs"
        />
        {parsed.length > 0 && (
          <div className="rounded-lg border max-h-56 overflow-y-auto text-xs">
            <table className="w-full">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Empresa</th>
                  <th className="px-2 py-1 text-left">Período</th>
                  <th className="px-2 py-1 text-right">Prêmio Total</th>
                  <th className="px-2 py-1 text-right">Sinistro</th>
                  <th className="px-2 py-1 text-right">Sin.%</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p, i) => {
                  const c = calcular(p.premioEmpresa, p.premioContinuidade, p.sinistro);
                  return (
                    <tr key={i} className={cn("border-t", !p.empresaId && "bg-destructive/10")}>
                      <td className="px-2 py-1">
                        {p.empresaNome || `${p.empresa} (não encontrada)`}
                      </td>
                      <td className="px-2 py-1">{labelPeriodo(p.periodo)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(c.premioTotal)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtMoeda(p.sinistro)}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{fmtPct(c.sinistralidade)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={importar} disabled={upsert.isPending || !validos.length}>
            Importar {validos.length > 0 ? `(${validos.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
