import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ArrowLeft, Car, DollarSign, TrendingUp, TrendingDown, Ban, Users, Plus, Download,
  Moon, Sun, Sunset, Cloud, Receipt, Trophy, Building2, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { useUberCorridas, type UberCorrida } from "@/hooks/useUberCorridas";
import { CorridaDialog } from "@/components/uber/CorridaDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const MOTIVOS = [
  "Plantão de Atendimento", "Envio de Material", "Técnica Honda", "Coleta de Preventivo",
  "Coleta de PSA", "Ação de Saúde", "Palestra", "Coleta de sangue", "Taxa cancelamento",
  "Implantação", "Treinamento Portal", "Integração", "Gravação da Palestra",
];
const TIPOS = ["Ida", "Volta", "Ida e Volta"];

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const parseData = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const parseHora = (s: string | null) => (s ? parseInt(s.split(":")[0], 10) : null);
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const PERIODOS_DIA = [
  { key: "madrugada", label: "Madrugada", range: "00h – 05h", icon: Moon, from: 0, to: 5 },
  { key: "manha", label: "Manhã", range: "06h – 11h", icon: Sun, from: 6, to: 11 },
  { key: "tarde", label: "Tarde", range: "12h – 17h", icon: Sunset, from: 12, to: 17 },
  { key: "noite", label: "Noite", range: "18h – 23h", icon: Cloud, from: 18, to: 23 },
] as const;

const liquido = (c: UberCorrida) => {
  const bruto = Number(c.valor || 0);
  const reemb = c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0;
  return bruto - reemb;
};

function Trend({ delta }: { delta: number | null }) {
  if (delta === null || !isFinite(delta)) return <span className="text-[10px] text-muted-foreground">—</span>;
  const up = delta >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-emerald-600" : "text-rose-600"}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

export default function UberDashboard() {
  const { isAdmin, isExecutivo } = useAuth();
  const canManageCorridas = isAdmin || isExecutivo;
  const { data: corridas = [], isLoading } = useUberCorridas();

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [dataIni, setDataIni] = useState(ymd(inicioMes));
  const [dataFim, setDataFim] = useState(ymd(hoje));
  const [fColab, setFColab] = useState("all");
  const [fMotivo, setFMotivo] = useState("all");
  const [fTipo, setFTipo] = useState("all");
  const [fEmpresa, setFEmpresa] = useState("all");
  const [fCriadoPor, setFCriadoPor] = useState("all");
  const [novaOpen, setNovaOpen] = useState(false);

  const empresasList = useMemo(
    () => Array.from(new Set(corridas.map((c) => c.empresa).filter(Boolean))).sort() as string[],
    [corridas]
  );
  const colabList = useMemo(
    () => Array.from(new Set(corridas.map((c) => c.colaborador).filter(Boolean))).sort() as string[],
    [corridas]
  );
  const criadoresList = useMemo(
    () => Array.from(new Set(corridas.map((c) => c.criado_por).filter(Boolean))).sort() as string[],
    [corridas]
  );

  const filtered = useMemo(() => {
    return corridas.filter((c) => {
      if (dataIni && c.data < dataIni) return false;
      if (dataFim && c.data > dataFim) return false;
      if (fColab !== "all" && c.colaborador !== fColab) return false;
      if (fMotivo !== "all" && (c.motivo ?? "") !== fMotivo) return false;
      if (fTipo !== "all" && (c.tipo ?? "") !== fTipo) return false;
      if (fEmpresa !== "all" && (c.empresa ?? "") !== fEmpresa) return false;
      if (fCriadoPor !== "all" && (c.criado_por ?? "") !== fCriadoPor) return false;
      return true;
    });
  }, [corridas, dataIni, dataFim, fColab, fMotivo, fTipo, fEmpresa, fCriadoPor]);

  // Período anterior (mesma duração imediatamente antes)
  const anterior = useMemo(() => {
    if (!dataIni || !dataFim) return [] as UberCorrida[];
    const ini = parseData(dataIni);
    const fim = parseData(dataFim);
    const durMs = fim.getTime() - ini.getTime();
    const antFim = new Date(ini.getTime() - 86400000);
    const antIni = new Date(antFim.getTime() - durMs);
    const antIniStr = ymd(antIni);
    const antFimStr = ymd(antFim);
    return corridas.filter((c) => c.data >= antIniStr && c.data <= antFimStr);
  }, [corridas, dataIni, dataFim]);

  const kpis = useMemo(() => {
    const validas = filtered.filter((c) => !c.cancelada);
    const antVal = anterior.filter((c) => !c.cancelada);
    const bruto = validas.reduce((s, c) => s + Number(c.valor || 0), 0);
    const reemb = validas.reduce((s, c) => s + (c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0), 0);
    const liq = bruto - reemb;
    const ticket = validas.length ? liq / validas.length : 0;
    const cancel = filtered.length - validas.length;
    const brutoAnt = antVal.reduce((s, c) => s + Number(c.valor || 0), 0);
    const reembAnt = antVal.reduce((s, c) => s + (c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0), 0);
    const liqAnt = brutoAnt - reembAnt;
    const tktAnt = antVal.length ? liqAnt / antVal.length : 0;
    const cancelAnt = anterior.length - antVal.length;
    const pct = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : ((a - b) / b) * 100);
    return {
      qtd: validas.length, qtdDelta: pct(validas.length, antVal.length),
      liq, liqDelta: pct(liq, liqAnt),
      ticket, ticketDelta: pct(ticket, tktAnt),
      reemb, reembPct: bruto > 0 ? (reemb / bruto) * 100 : 0,
      reembDelta: pct(reemb, reembAnt),
      cancel, cancelPct: filtered.length ? (cancel / filtered.length) * 100 : 0,
      cancelDelta: pct(cancel, cancelAnt),
    };
  }, [filtered, anterior]);

  const porMotivo = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const k = c.motivo || "Sem motivo";
      const cur = map.get(k) ?? { nome: k, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += liquido(c);
      map.set(k, cur);
    });
    const arr = Array.from(map.values()).sort((a, b) => b.qtd - a.qtd);
    const total = arr.reduce((s, r) => s + r.qtd, 0);
    return arr.map((r) => ({ ...r, pct: total ? (r.qtd / total) * 100 : 0 }));
  }, [filtered]);

  const porPeriodoDia = useMemo(() => {
    const buckets = PERIODOS_DIA.map((p) => ({ ...p, qtd: 0, valor: 0 }));
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const h = parseHora(c.horario);
      if (h === null) return;
      const b = buckets.find((x) => h >= x.from && h <= x.to);
      if (b) { b.qtd += 1; b.valor += liquido(c); }
    });
    const total = buckets.reduce((s, b) => s + b.qtd, 0);
    const max = Math.max(1, ...buckets.map((b) => b.qtd));
    return buckets.map((b) => ({ ...b, pct: total ? (b.qtd / total) * 100 : 0, barPct: (b.qtd / max) * 100 }));
  }, [filtered]);

  const rankingColaboradores = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number; reemb: number; bruto: number }>();
    filtered.filter((c) => !c.cancelada).forEach((c) => {
      const cur = map.get(c.colaborador) ?? { nome: c.colaborador, qtd: 0, valor: 0, reemb: 0, bruto: 0 };
      cur.qtd += 1;
      cur.valor += liquido(c);
      cur.bruto += Number(c.valor || 0);
      cur.reemb += c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0;
      map.set(c.colaborador, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, ticket: r.qtd ? r.valor / r.qtd : 0, reembPct: r.bruto ? (r.reemb / r.bruto) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered]);

  const rankingEmpresas = useMemo(() => {
    const map = new Map<string, { nome: string; qtd: number; valor: number }>();
    filtered.filter((c) => !c.cancelada && c.empresa).forEach((c) => {
      const k = c.empresa!;
      const cur = map.get(k) ?? { nome: k, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += liquido(c);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [filtered]);

  const tendenciaMensal = useMemo(() => {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const buckets: { label: string; ym: string; qtd: number; valor: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        ym, qtd: 0, valor: 0,
      });
    }
    corridas.filter((c) => !c.cancelada).forEach((c) => {
      const ym = c.data.slice(0, 7);
      const b = buckets.find((x) => x.ym === ym);
      if (b) { b.qtd += 1; b.valor += liquido(c); }
    });
    if (buckets.filter((b) => b.qtd > 0).length === 1) {
      return [...buckets, ...buckets.slice(-1).map((b) => ({ ...b, label: b.label + " " }))];
    }
    return buckets;
  }, [corridas, hoje]);

  const historico = useMemo(
    () => [...filtered].sort((a, b) => (a.data === b.data
      ? (b.horario ?? "").localeCompare(a.horario ?? "")
      : b.data.localeCompare(a.data)
    )).slice(0, 30),
    [filtered]
  );

  const limparFiltros = () => {
    setDataIni(ymd(inicioMes)); setDataFim(ymd(hoje));
    setFColab("all"); setFMotivo("all"); setFTipo("all"); setFEmpresa("all"); setFCriadoPor("all");
  };

  const exportar = () => {
    const rows = filtered.map((c) => ({
      Data: c.data, Horário: c.horario ?? "", Colaborador: c.colaborador,
      Empresa: c.empresa ?? "", Origem: c.origem ?? "", Destino: c.destino ?? "",
      Motivo: c.motivo ?? "", Tipo: c.tipo ?? "",
      "Valor (R$)": Number(c.valor || 0),
      "Reembolso (R$)": c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0,
      "Pagamento": c.forma_pagamento ?? "", "Responsável": c.responsavel ?? "",
      "Criado por": c.criado_por ?? "", Cancelada: c.cancelada ? "Sim" : "Não",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Corridas");
    XLSX.writeFile(wb, `uber-corporativo-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const periodoLabel = useMemo(() => {
    if (!dataIni || !dataFim) return "";
    return `${parseData(dataIni).toLocaleDateString("pt-BR")} → ${parseData(dataFim).toLocaleDateString("pt-BR")}`;
  }, [dataIni, dataFim]);

  return (
    <div className="container mx-auto p-4 lg:p-6 space-y-5">
      {/* Cabeçalho executivo */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/uber"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Gestão de Mobilidade</div>
            <h1 className="text-2xl font-bold leading-tight">Uber Corporativo</h1>
            <p className="text-xs text-muted-foreground">{periodoLabel}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button asChild variant="outline" size="sm"><Link to="/uber"><Users className="h-4 w-4 mr-1" />Corridas</Link></Button>
          {canManageCorridas && <Button size="sm" onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova corrida</Button>}
        </div>
      </div>

      {/* Barra de filtros pegajosa */}
      <Card className="sticky top-2 z-20 p-3 backdrop-blur bg-card/95 border-border/60 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
          <div><Label>De</Label><Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} /></div>
          <div><Label>Até</Label><Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
          <div><Label>Colaborador</Label>
            <Select value={fColab} onValueChange={setFColab}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{colabList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Motivo</Label>
            <Select value={fMotivo} onValueChange={setFMotivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tipo</Label>
            <Select value={fTipo} onValueChange={setFTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Empresa</Label>
            <Select value={fEmpresa} onValueChange={setFEmpresa}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem>{empresasList.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Criado por</Label>
            <Select value={fCriadoPor} onValueChange={setFCriadoPor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos</SelectItem>{criadoresList.map((c) => <SelectItem key={c!} value={c!}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={limparFiltros}>Limpar filtros</Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Carregando...</Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={Car} label="Corridas" value={fmtNum(kpis.qtd)} sub="não canceladas" delta={kpis.qtdDelta} tone="info" />
            <KpiCard icon={DollarSign} label="Gasto líquido" value={fmtMoney(kpis.liq)} sub="após reembolsos" delta={kpis.liqDelta} tone="success" invert />
            <KpiCard icon={TrendingUp} label="Ticket médio" value={fmtMoney(kpis.ticket)} sub="por corrida" delta={kpis.ticketDelta} tone="info" invert />
            <KpiCard icon={Receipt} label="Reembolsos" value={fmtMoney(kpis.reemb)} sub={`${kpis.reembPct.toFixed(1)}% sobre bruto`} delta={kpis.reembDelta} tone="warning" />
            <KpiCard icon={Ban} label="Canceladas" value={fmtNum(kpis.cancel)} sub={`${kpis.cancelPct.toFixed(1)}% do total`} delta={kpis.cancelDelta} tone="danger" invert />
          </div>

          {/* Motivo + Período do dia */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold">Distribuição por Motivo</div>
                  <div className="text-xs text-muted-foreground">Nº de corridas · % do total · gasto líquido</div>
                </div>
                <Trophy className="h-4 w-4 text-amber-500" />
              </div>
              <div className="space-y-2.5">
                {porMotivo.length === 0 && <div className="text-sm text-muted-foreground">Sem dados no período.</div>}
                {porMotivo.map((m, i) => {
                  const destaque = i < 3;
                  return (
                    <div key={m.nome}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-medium ${destaque ? "text-foreground" : "text-muted-foreground"}`}>
                          {i + 1}. {m.nome}
                        </span>
                        <span className="tabular-nums font-semibold">
                          {fmtNum(m.qtd)} · <span className="text-muted-foreground">{m.pct.toFixed(1)}%</span> · {fmtMoney(m.valor)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={destaque ? "h-full bg-primary" : "h-full bg-primary/40"}
                          style={{ width: `${Math.max(2, m.pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-sm font-semibold mb-1">Corridas por Período do Dia</div>
              <div className="text-xs text-muted-foreground mb-4">Distribuição ao longo das 24h</div>
              <div className="grid grid-cols-2 gap-3">
                {porPeriodoDia.map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.key} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon className="h-4 w-4" />{p.label}
                        <span className="ml-auto text-[10px]">{p.range}</span>
                      </div>
                      <div className="mt-1 text-2xl font-bold tabular-nums">{fmtNum(p.qtd)}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                        <span>{p.pct.toFixed(1)}% do total</span>
                        <span className="font-semibold text-foreground">{fmtMoney(p.valor)}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${p.barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Ranking colaboradores + empresas */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Principais Colaboradores</div>
                  <div className="text-xs text-muted-foreground">Top 10 por gasto líquido</div>
                </div>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead className="text-right">Corridas</TableHead>
                    <TableHead className="text-right">Gasto líquido</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">% reemb.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingColaboradores.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem dados</TableCell></TableRow>
                  )}
                  {rankingColaboradores.map((r, i) => (
                    <TableRow key={r.nome}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(r.qtd)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmtMoney(r.valor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(r.ticket)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.reembPct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Empresas Atendidas</div>
                  <div className="text-xs text-muted-foreground">Top 8 por gasto líquido</div>
                </div>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                {rankingEmpresas.length === 0 && <div className="text-sm text-muted-foreground">Sem dados</div>}
                {rankingEmpresas.map((e, i) => {
                  const max = rankingEmpresas[0]?.valor || 1;
                  return (
                    <div key={e.nome}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate mr-2" title={e.nome}>{i + 1}. {e.nome}</span>
                        <span className="tabular-nums font-semibold whitespace-nowrap">{fmtMoney(e.valor)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(e.valor / max) * 100}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{fmtNum(e.qtd)} corridas</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Tendência mensal */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Tendência Mensal</div>
                <div className="text-xs text-muted-foreground">Corridas e gasto líquido nos últimos 8 meses</div>
              </div>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={tendenciaMensal} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Math.round(v / 1000)}k`} />
                <RTooltip formatter={(v: any, n: any) => (n === "Gasto líquido" ? fmtMoney(Number(v)) : fmtNum(Number(v)))} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="qtd" name="Corridas" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="valor" name="Gasto líquido" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Histórico */}
          <Card className="p-0 overflow-hidden">
            <div className="p-5 pb-3">
              <div className="text-sm font-semibold">Histórico recente</div>
              <div className="text-xs text-muted-foreground">Últimas 30 corridas do período filtrado</div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Trajeto</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Reembolso</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.length === 0 && (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma corrida no período</TableCell></TableRow>
                  )}
                  {historico.map((c) => {
                    const reemb = c.tem_reembolso ? Number(c.valor_reembolso ?? c.reembolso ?? 0) : 0;
                    return (
                      <TableRow key={c.id} className={c.cancelada ? "opacity-60" : ""}>
                        <TableCell>{parseData(c.data).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{c.horario ?? "—"}</TableCell>
                        <TableCell className="font-medium">{c.colaborador}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={c.empresa ?? ""}>{c.empresa ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate" title={`${c.origem ?? ""} → ${c.destino ?? ""}`}>
                          {(c.origem ?? "—")} → {(c.destino ?? "—")}
                        </TableCell>
                        <TableCell className="text-xs">{c.motivo ?? "—"}</TableCell>
                        <TableCell className="text-xs">{c.tipo ?? "—"}</TableCell>
                        <TableCell className={`text-right tabular-nums font-semibold ${c.cancelada ? "line-through" : ""}`}>{fmtMoney(Number(c.valor || 0))}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{reemb > 0 ? fmtMoney(reemb) : "—"}</TableCell>
                        <TableCell className="text-xs">{c.forma_pagamento ?? "—"}</TableCell>
                        <TableCell>
                          {c.cancelada
                            ? <Badge variant="secondary" className="bg-muted text-muted-foreground">Cancelada</Badge>
                            : <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Ativa</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <CorridaDialog open={novaOpen} onOpenChange={setNovaOpen} corrida={null} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{children}</div>;
}

function KpiCard({
  icon: Icon, label, value, sub, delta, tone, invert = false,
}: {
  icon: any; label: string; value: string; sub: string; delta: number | null;
  tone: "info" | "success" | "warning" | "danger"; invert?: boolean;
}) {
  const toneMap: Record<string, string> = {
    info: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  // Se `invert`, um delta negativo é bom (ex: gasto caindo)
  const displayDelta = delta === null ? null : (invert ? -delta : delta);
  return (
    <Card className="p-4 rounded-2xl border-border/60 shadow-sm">
      <div className="flex items-start justify-between">
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <Trend delta={displayDelta} />
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Card>
  );
}
