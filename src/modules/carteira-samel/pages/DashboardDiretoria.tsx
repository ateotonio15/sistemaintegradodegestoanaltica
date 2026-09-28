import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDown, ArrowUp, Download, AlertTriangle, Send, CheckCircle2, Percent, Clock, Star, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAvaliacoesUnificadas, useFormulariosPerguntas, resumir, variacao, AvaliacaoRow, Resumo } from "../hooks/useAvaliacoesUnificadas";

const COR_RH = "hsl(var(--primary))";
const COR_PL = "hsl(var(--warning, 38 92% 50%))";
const COR_STATUS: Record<string, string> = {
  respondido: "hsl(var(--primary))",
  enviado: "hsl(var(--muted-foreground))",
  lembrete: "hsl(var(--destructive))",
};
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Periodo = "mes" | "3m" | "ano" | "todos" | "custom";

function toDate(s: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function fmtData(s: string | null) {
  const d = toDate(s);
  return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "—";
}
function parseLocal(s: string, end = false) {
  const [y, m, d] = s.split("-").map(Number);
  return end ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d);
}
function intervalo(p: Periodo, ini: string, fim: string): [Date, Date] | null {
  const hoje = new Date();
  const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
  if (p === "mes") return [new Date(hoje.getFullYear(), hoje.getMonth(), 1), fimHoje];
  if (p === "3m") return [new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1), fimHoje];
  if (p === "ano") return [new Date(hoje.getFullYear(), 0, 1), fimHoje];
  if (p === "custom" && ini && fim) return [parseLocal(ini), parseLocal(fim, true)];
  return null;
}
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const nota = (n: number | null) => (n == null ? "—" : n.toFixed(2).replace(".", ","));

function Variacao({ v, invert }: { v: number | null; invert?: boolean }) {
  if (v == null) return <span className="text-[11px] text-muted-foreground">sem comparativo</span>;
  const bom = invert ? v < 0 : v >= 0;
  const Icon = v >= 0 ? ArrowUp : ArrowDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", bom ? "text-primary" : "text-destructive")}>
      <Icon className="h-3 w-3" /> {Math.abs(v).toFixed(1).replace(".", ",")}% vs. período anterior
    </span>
  );
}

function Kpi({ icon: Icon, label, total, rh, pl, v, invert }: any) {
  return (
    <Card className="p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <div className="text-2xl font-bold tracking-tight">{total}</div>
      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>RH: <b className="text-foreground">{rh}</b></span>
        <span>Plantão: <b className="text-foreground">{pl}</b></span>
      </div>
      <Variacao v={v} invert={invert} />
    </Card>
  );
}

function Vazio({ texto = "Sem dados para os filtros selecionados." }) {
  return <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">{texto}</div>;
}

function TipoBadge({ tipo }: { tipo: string }) {
  return <Badge variant="outline" className={tipo === "rh" ? "border-primary/40 text-primary" : "border-warning/40 text-warning"}>{tipo === "rh" ? "RH" : "Plantão"}</Badge>;
}
function StatusBadge({ s }: { s: string }) {
  const cls = s === "respondido" ? "bg-primary/10 text-primary" : s === "lembrete" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium capitalize", cls)}>{s}</span>;
}

export default function DashboardDiretoria() {
  const { data: rows = [], isLoading } = useAvaliacoesUnificadas();
  const { data: perguntas = {} } = useFormulariosPerguntas();

  const [periodo, setPeriodo] = useState<Periodo>("3m");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [tipo, setTipo] = useState<"todas" | "rh" | "plantao">("todas");
  const [empresa, setEmpresa] = useState("todas");
  const [executiva, setExecutiva] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [diasSemResp, setDiasSemResp] = useState(15);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<{ col: keyof AvaliacaoRow; asc: boolean }>({ col: "data_envio", asc: false });
  const [pagina, setPagina] = useState(0);
  const POR_PAGINA = 20;

  const empresas = useMemo(() => Array.from(new Set(rows.map((r) => r.empresa_nome))).sort(), [rows]);
  const executivas = useMemo(() => Array.from(new Set(rows.map((r) => r.executiva_nome))).sort(), [rows]);
  const statusList = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);

  const filtroBase = (r: AvaliacaoRow) =>
    (tipo === "todas" || r.tipo === tipo) &&
    (empresa === "todas" || r.empresa_nome === empresa) &&
    (executiva === "todas" || r.executiva_nome === executiva) &&
    (status === "todos" || r.status === status);

  const range = intervalo(periodo, ini, fim);
  const noIntervalo = (r: AvaliacaoRow, a: Date, b: Date) => {
    const d = toDate(r.data_envio);
    return !!d && d >= a && d <= b;
  };

  const filtradas = useMemo(
    () => rows.filter((r) => filtroBase(r) && (!range || noIntervalo(r, range[0], range[1]))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, tipo, empresa, executiva, status, periodo, ini, fim],
  );

  const anteriores = useMemo(() => {
    if (!range) return null;
    const dur = range[1].getTime() - range[0].getTime();
    const a = new Date(range[0].getTime() - dur - 1000);
    const b = new Date(range[0].getTime() - 1000);
    return rows.filter((r) => filtroBase(r) && noIntervalo(r, a, b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tipo, empresa, executiva, status, periodo, ini, fim]);

  const tot = resumir(filtradas);
  const rh = resumir(filtradas.filter((r) => r.tipo === "rh"));
  const pl = resumir(filtradas.filter((r) => r.tipo === "plantao"));
  const ant: Resumo | null = anteriores ? resumir(anteriores) : null;

  const evolucao = useMemo(() => {
    const m = new Map<string, any>();
    filtradas.forEach((r) => {
      const d = toDate(r.data_envio);
      if (!d) return;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const o = m.get(k) || { k, mes: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, envRH: 0, respRH: 0, envPL: 0, respPL: 0 };
      if (r.tipo === "rh") { o.envRH++; if (r.status === "respondido") o.respRH++; }
      else { o.envPL++; if (r.status === "respondido") o.respPL++; }
      m.set(k, o);
    });
    return Array.from(m.values()).sort((a, b) => a.k.localeCompare(b.k));
  }, [filtradas]);

  const comparativo = [
    { nome: "Taxa de resposta (%)", RH: +rh.taxa.toFixed(1), Plantão: +pl.taxa.toFixed(1) },
    { nome: "Nota média (x20)", RH: rh.media ? +(rh.media * 20).toFixed(1) : 0, Plantão: pl.media ? +(pl.media * 20).toFixed(1) : 0 },
  ];

  const porStatus = useMemo(() => {
    const m: Record<string, number> = {};
    filtradas.forEach((r) => (m[r.status] = (m[r.status] || 0) + 1));
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtradas]);

  const agrupar = (key: "empresa_nome" | "executiva_nome") => {
    const m = new Map<string, AvaliacaoRow[]>();
    filtradas.forEach((r) => m.set(r[key], [...(m.get(r[key]) || []), r]));
    return Array.from(m.entries()).map(([nome, lst]) => ({ nome, ...resumir(lst) }));
  };
  const porEmpresa = useMemo(() => agrupar("empresa_nome"), [filtradas]); // eslint-disable-line
  const porExecutiva = useMemo(() => agrupar("executiva_nome").sort((a, b) => b.enviadas - a.enviadas).slice(0, 15), [filtradas]); // eslint-disable-line

  const rankTaxa = [...porEmpresa].filter((e) => e.enviadas > 0).sort((a, b) => b.taxa - a.taxa);
  const rankNota = [...porEmpresa].filter((e) => e.media != null).sort((a, b) => (b.media ?? 0) - (a.media ?? 0));

  const criterios = useMemo(() => {
    const m: Record<string, { rh: number[]; pl: number[] }> = {};
    filtradas.forEach((r) => {
      if (!r.respostas) return;
      Object.entries(r.respostas).forEach(([k, v]) => {
        const n = Number(v);
        if (!perguntas[k] || isNaN(n) || n <= 0) return;
        m[k] = m[k] || { rh: [], pl: [] };
        (r.tipo === "rh" ? m[k].rh : m[k].pl).push(n);
      });
    });
    const avg = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0);
    return Object.keys(m).sort().map((k) => ({
      nome: k.toUpperCase(), titulo: perguntas[k], RH: avg(m[k].rh), Plantão: avg(m[k].pl),
    }));
  }, [filtradas, perguntas]);

  const alertas = useMemo(() => {
    const agora = Date.now();
    const dias = (s: string | null) => { const d = toDate(s); return d ? Math.floor((agora - d.getTime()) / 86400000) : 0; };
    const semResp = filtradas.filter((r) => r.status !== "respondido" && dias(r.data_envio) > diasSemResp);
    const empSemResp = Array.from(new Set(semResp.map((r) => r.empresa_nome)));
    const abaixo = tot.media != null ? porEmpresa.filter((e) => e.media != null && e.media < tot.media!).sort((a, b) => (a.media ?? 0) - (b.media ?? 0)) : [];
    const lembreteAntigo = filtradas.filter((r) => r.status === "lembrete" && dias(r.lembrete_enviado_em || r.data_envio) > 30);
    return { empSemResp, abaixo, lembreteAntigo };
  }, [filtradas, diasSemResp, porEmpresa, tot.media]);

  const tabela = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const l = filtradas.filter((r) => !q || r.empresa_nome.toLowerCase().includes(q) || r.executiva_nome.toLowerCase().includes(q));
    const { col, asc } = ordem;
    return l.sort((a, b) => {
      const x = a[col] ?? ""; const y = b[col] ?? "";
      return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1);
    });
  }, [filtradas, busca, ordem]);
  const totalPag = Math.max(1, Math.ceil(tabela.length / POR_PAGINA));
  const pag = tabela.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const exportar = () => {
    const ws = XLSX.utils.json_to_sheet(tabela.map((r) => ({
      Tipo: r.tipo === "rh" ? "RH" : "Plantão", Empresa: r.empresa_nome, Executiva: r.executiva_nome, Status: r.status,
      "Data de envio": fmtData(r.data_envio), Resposta: fmtData(r.data_resposta), Nota: r.nota_media ?? "", Comentário: r.comentario ?? "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Avaliações");
    XLSX.writeFile(wb, "dashboard-diretoria-avaliacoes.xlsx");
  };

  const th = (label: string, col: keyof AvaliacaoRow) => (
    <TableHead>
      <button className="inline-flex items-center gap-1" onClick={() => setOrdem((o) => ({ col, asc: o.col === col ? !o.asc : true }))}>
        {label}<ArrowUpDown className="h-3 w-3" />
      </button>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-3 md:grid-cols-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Período</p>
          <Select value={periodo} onValueChange={(v) => { setPeriodo(v as Periodo); setPagina(0); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês atual</SelectItem><SelectItem value="3m">Últimos 3 meses</SelectItem>
              <SelectItem value="ano">Ano atual</SelectItem><SelectItem value="todos">Todo o período</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "custom" && (<>
          <div className="space-y-1"><p className="text-[11px] text-muted-foreground">De</p><Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="w-36" /></div>
          <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Até</p><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-36" /></div>
        </>)}
        <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Tipo</p>
          <Select value={tipo} onValueChange={(v) => { setTipo(v as any); setPagina(0); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="rh">RH</SelectItem><SelectItem value="plantao">Plantão</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Empresa</p>
          <Select value={empresa} onValueChange={(v) => { setEmpresa(v); setPagina(0); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{empresas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Executiva</p>
          <Select value={executiva} onValueChange={(v) => { setExecutiva(v); setPagina(0); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todas">Todas</SelectItem>{executivas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><p className="text-[11px] text-muted-foreground">Status</p>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(0); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="todos">Todos</SelectItem>{statusList.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Send} label="Avaliações enviadas" total={tot.enviadas.toLocaleString("pt-BR")} rh={rh.enviadas} pl={pl.enviadas} v={variacao(tot.enviadas, ant?.enviadas ?? null)} />
        <Kpi icon={CheckCircle2} label="Respostas recebidas" total={tot.respondidas.toLocaleString("pt-BR")} rh={rh.respondidas} pl={pl.respondidas} v={variacao(tot.respondidas, ant?.respondidas ?? null)} />
        <Kpi icon={Percent} label="Taxa de resposta" total={pct(tot.taxa)} rh={pct(rh.taxa)} pl={pct(pl.taxa)} v={variacao(tot.taxa, ant?.taxa ?? null)} />
        <Kpi icon={Clock} label="Pendentes / lembrete" total={`${tot.pendentes} / ${tot.lembrete}`} rh={`${rh.pendentes}/${rh.lembrete}`} pl={`${pl.pendentes}/${pl.lembrete}`} v={variacao(tot.pendentes, ant?.pendentes ?? null)} invert />
        <Kpi icon={Star} label="Nota média (1 a 5)" total={nota(tot.media)} rh={nota(rh.media)} pl={nota(pl.media)} v={variacao(tot.media, ant?.media ?? null)} />
      </div>

      {/* Pontos de atenção */}
      <Card className="p-4 space-y-3 border-destructive/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-destructive" />Pontos de atenção</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">Sem resposta há mais de
            <Input type="number" min={1} value={diasSemResp} onChange={(e) => setDiasSemResp(Math.max(1, Number(e.target.value) || 1))} className="h-7 w-16" /> dias
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <div><p className="font-medium">{alertas.empSemResp.length} empresa(s) sem resposta</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{alertas.empSemResp.slice(0, 8).join(", ") || "Nenhuma"}{alertas.empSemResp.length > 8 ? "…" : ""}</p></div>
          <div><p className="font-medium">{alertas.abaixo.length} empresa(s) com nota abaixo da média ({nota(tot.media)})</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{alertas.abaixo.slice(0, 6).map((e) => `${e.nome} (${nota(e.media)})`).join(", ") || "Nenhuma"}</p></div>
          <div><p className="font-medium">{alertas.lembreteAntigo.length} lembrete(s) pendente(s) há mais de 30 dias</p>
            <p className="text-xs text-muted-foreground line-clamp-3">{Array.from(new Set(alertas.lembreteAntigo.map((r) => r.empresa_nome))).slice(0, 8).join(", ") || "Nenhum"}</p></div>
        </div>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Evolução mensal — envios x respostas</h3>
          {evolucao.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={evolucao}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend />
                <Line dataKey="envRH" name="Envios RH" stroke={COR_RH} strokeDasharray="4 3" />
                <Line dataKey="respRH" name="Respostas RH" stroke={COR_RH} strokeWidth={2} />
                <Line dataKey="envPL" name="Envios Plantão" stroke={COR_PL} strokeDasharray="4 3" />
                <Line dataKey="respPL" name="Respostas Plantão" stroke={COR_PL} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>) : <Vazio />}
        </Card>
        <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Comparativo RH x Plantão</h3>
          {tot.enviadas ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={comparativo}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} domain={[0, 100]} /><Tooltip /><Legend />
                <Bar dataKey="RH" fill={COR_RH} radius={[4, 4, 0, 0]} /><Bar dataKey="Plantão" fill={COR_PL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>) : <Vazio />}
          <p className="text-[11px] text-muted-foreground">Nota média convertida para escala 0–100 (nota × 20) para comparar no mesmo eixo.</p>
        </Card>
        <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Distribuição por status</h3>
          {porStatus.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart><Pie data={porStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {porStatus.map((s) => <Cell key={s.name} fill={COR_STATUS[s.name] || "hsl(var(--accent))"} />)}
              </Pie><Tooltip /><Legend /></PieChart>
            </ResponsiveContainer>) : <Vazio />}
        </Card>
        <Card className="p-4"><h3 className="mb-2 text-sm font-semibold">Desempenho por executiva</h3>
          {porExecutiva.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porExecutiva} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" fontSize={11} /><YAxis type="category" dataKey="nome" width={120} fontSize={10} /><Tooltip formatter={(v: any, n: any) => n === "Taxa (%)" ? `${Number(v).toFixed(1)}%` : v} /><Legend />
                <Bar dataKey="enviadas" name="Avaliações" fill={COR_RH} /><Bar dataKey="taxa" name="Taxa (%)" fill={COR_PL} />
              </BarChart>
            </ResponsiveContainer>) : <Vazio />}
        </Card>
        <Card className="p-4 lg:col-span-2"><h3 className="mb-2 text-sm font-semibold">Média por critério</h3>
          {criterios.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={criterios}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} domain={[0, 5]} />
                <Tooltip labelFormatter={(_, p: any) => p?.[0]?.payload?.titulo || ""} /><Legend />
                <Bar dataKey="RH" fill={COR_RH} radius={[4, 4, 0, 0]} /><Bar dataKey="Plantão" fill={COR_PL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>) : <Vazio texto="Ainda não há respostas com notas por critério." />}
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid gap-3 md:grid-cols-2">
        {[
          { t: "Taxa de resposta por empresa", lst: rankTaxa, val: (e: any) => pct(e.taxa) },
          { t: "Nota média por empresa", lst: rankNota, val: (e: any) => nota(e.media) },
        ].map(({ t, lst, val }) => (
          <Card key={t} className="p-4"><h3 className="mb-2 text-sm font-semibold">{t}</h3>
            {lst.length ? (
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><p className="mb-1 font-medium text-primary">Maiores</p>{lst.slice(0, 5).map((e) => <div key={e.nome} className="flex justify-between gap-2 py-0.5"><span className="truncate">{e.nome}</span><b>{val(e)}</b></div>)}</div>
                <div><p className="mb-1 font-medium text-destructive">Menores</p>{[...lst].reverse().slice(0, 5).map((e) => <div key={e.nome} className="flex justify-between gap-2 py-0.5"><span className="truncate">{e.nome}</span><b>{val(e)}</b></div>)}</div>
              </div>) : <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Avaliações detalhadas ({tabela.length.toLocaleString("pt-BR")})</h3>
          <div className="flex gap-2">
            <Input placeholder="Buscar empresa ou executiva" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} className="w-64" />
            <Button variant="outline" size="sm" onClick={exportar} disabled={!tabela.length}><Download className="mr-1 h-4 w-4" />Excel</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              {th("Tipo", "tipo")}{th("Empresa", "empresa_nome")}{th("Executiva", "executiva_nome")}{th("Status", "status")}
              {th("Envio", "data_envio")}{th("Resposta", "data_resposta")}{th("Nota", "nota_media")}
            </TableRow></TableHeader>
            <TableBody>
              {pag.length ? pag.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><TipoBadge tipo={r.tipo} /></TableCell>
                  <TableCell className="max-w-[260px] truncate">{r.empresa_nome}</TableCell>
                  <TableCell>{r.executiva_nome}</TableCell>
                  <TableCell><StatusBadge s={r.status} /></TableCell>
                  <TableCell>{fmtData(r.data_envio)}</TableCell>
                  <TableCell>{fmtData(r.data_resposta)}</TableCell>
                  <TableCell>{nota(r.nota_media)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma avaliação encontrada.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
          <span>Página {pagina + 1} de {totalPag}</span>
          <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPag} onClick={() => setPagina((p) => p + 1)}>Próxima</Button>
        </div>
      </Card>
    </div>
  );
}
