import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Car, DollarSign, TrendingUp, Ban, Users, Plus, Download, Moon, Sun, Sunset, Sunrise,
  Receipt, Building2, ArrowUpRight, ArrowDownRight, X, Star, MoonStar, Clock, Inbox,
} from "lucide-react";
import { useUberCorridas, type UberCorrida } from "@/hooks/useUberCorridas";
import { CorridaDialog } from "@/components/uber/CorridaDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart,
} from "recharts";
import {
  DIAS_SEMANA, NAO_INFORMADO, PERIODOS, SEM_SERVICO, agrupar, colabDe, contaNoPainel, diaSemanaDe, ehNoturna,
  horaDe, liquido, noPeriodo, passaFacetas, periodoAnterior, periodoDe, reembolsoDe, servicoDe, statusCorrida, totais,
  type FiltrosDash, type PeriodoKey,
} from "@/lib/uber-dashboard";

const MOTIVOS = [
  "Plantão de Atendimento", "Envio de Material", "Técnica Honda", "Coleta de Preventivo",
  "Coleta de PSA", "Ação de Saúde", "Palestra", "Coleta de sangue", "Taxa cancelamento",
  "Implantação", "Treinamento Portal", "Integração", "Gravação da Palestra",
];
const TIPOS = ["Ida", "Volta", "Ida e Volta"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => v.toLocaleString("pt-BR");
const fmtPct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const brData = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const verde = (a: number) => `hsl(var(--primary) / ${a})`;
const CINZA = "hsl(var(--muted-foreground) / 0.45)";
const PERIODO_ICON: Record<PeriodoKey, any> = { madrugada: Moon, manha: Sunrise, tarde: Sun, noite: Sunset };
const PERIODO_TOM: Record<PeriodoKey, number> = { madrugada: 0.55, manha: 0.3, tarde: 0.42, noite: 0.55 };
const pctDelta = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : null) : ((a - b) / b) * 100);

type Facet = Exclude<keyof FiltrosDash, "de" | "ate">;

function atalhos(hoje: Date) {
  const y = hoje.getFullYear(), m = hoje.getMonth();
  const menos = (n: number) => ymd(new Date(y, m, hoje.getDate() - n));
  return [
    { label: "Este mês", de: ymd(new Date(y, m, 1)), ate: ymd(hoje) },
    { label: "Mês anterior", de: ymd(new Date(y, m - 1, 1)), ate: ymd(new Date(y, m, 0)) },
    { label: "Últimos 30 dias", de: menos(29), ate: ymd(hoje) },
    { label: "Últimos 90 dias", de: menos(89), ate: ymd(hoje) },
    { label: "Este ano", de: ymd(new Date(y, 0, 1)), ate: ymd(hoje) },
  ];
}

export default function UberDashboard() {
  const { isAdmin, isExecutivo } = useAuth();
  const canManageCorridas = isAdmin || isExecutivo;
  const { data: corridas = [], isLoading } = useUberCorridas();

  const hoje = useMemo(() => new Date(), []);
  const presets = useMemo(() => atalhos(hoje), [hoje]);
  const [f, setF] = useState<FiltrosDash>({ de: presets[0].de, ate: presets[0].ate });
  const [incluirPend, setIncluirPend] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);

  const setFacet = (k: Facet, v: any) => setF((p) => ({ ...p, [k]: v === "all" ? undefined : v }));
  const toggleFacet = (k: Facet, v: any) => setF((p) => ({ ...p, [k]: p[k] === v ? undefined : v }));
  const limpar = () => setF({ de: presets[0].de, ate: presets[0].ate });

  const listas = useMemo(() => ({
    empresas: [...new Set(corridas.map((c) => c.empresa).filter(Boolean))].sort() as string[],
    colabs: [...new Set(corridas.map(colabDe))].filter((n) => n !== NAO_INFORMADO).sort(),
    criadores: [...new Set(corridas.map((c) => c.criado_por).filter(Boolean))].sort() as string[],
    servicos: [...new Set(corridas.map((c) => c.servico_uber?.trim()).filter(Boolean))].sort() as string[],
  }), [corridas]);

  // Base sets
  const facetadas = useMemo(() => corridas.filter((c) => passaFacetas(c, f)), [corridas, f]);
  const noPer = useMemo(() => facetadas.filter((c) => noPeriodo(c, f.de, f.ate)), [facetadas, f.de, f.ate]);
  const painel = useMemo(() => noPer.filter((c) => contaNoPainel(c, incluirPend)), [noPer, incluirPend]);
  const pendentes = useMemo(() => noPer.filter((c) => statusCorrida(c) === "pendente"), [noPer]);
  const pendTot = useMemo(() => totais(pendentes), [pendentes]);

  const kpis = useMemo(() => {
    const ant = periodoAnterior(f.de, f.ate);
    const antRows = facetadas.filter((c) => noPeriodo(c, ant.de, ant.ate));
    const a = totais(painel), b = totais(antRows.filter((c) => contaNoPainel(c, incluirPend)));
    const canc = noPer.filter((c) => c.cancelada).length;
    const cancAnt = antRows.filter((c) => c.cancelada).length;
    return {
      ...a, cancel: canc, antLabel: `${brData(ant.de)} a ${brData(ant.ate)}`,
      dQtd: pctDelta(a.qtd, b.qtd), dLiq: pctDelta(a.liq, b.liq), dTicket: pctDelta(a.ticket, b.ticket),
      dReemb: pctDelta(a.reemb, b.reemb), dCancel: pctDelta(canc, cancAnt),
      cancelPct: noPer.length ? (canc / noPer.length) * 100 : 0,
    };
  }, [painel, facetadas, noPer, f.de, f.ate, incluirPend]);

  const colabs = useMemo(() => agrupar(painel, colabDe), [painel]);
  const empresas = useMemo(() => agrupar(painel, (c) => c.empresa || NAO_INFORMADO), [painel]);
  const motivos = useMemo(() => agrupar(painel, (c) => c.motivo || NAO_INFORMADO), [painel]);
  const servicos = useMemo(() => agrupar(painel, servicoDe, [SEM_SERVICO]), [painel]);

  const destaque = colabs.find((c) => !c.naoInformado) ?? null;
  const noturnas = useMemo(() => {
    const rows = painel.filter((c) => ehNoturna(horaDe(c.horario)));
    return totais(rows);
  }, [painel]);

  const comHora = useMemo(() => painel.filter((c) => horaDe(c.horario) !== null), [painel]);
  const semHora = painel.length - comHora.length;

  const heat = useMemo(() => {
    const g = DIAS_SEMANA.map(() => Array(24).fill(0) as number[]);
    comHora.forEach((c) => { g[diaSemanaDe(c.data)][horaDe(c.horario)!] += 1; });
    let pico = { d: 0, h: 0, n: 0 };
    g.forEach((row, d) => row.forEach((n, h) => { if (n > pico.n) pico = { d, h, n }; }));
    return { g, pico };
  }, [comHora]);

  const porPeriodo = useMemo(() => {
    const tot = comHora.length;
    return PERIODOS.map((p) => {
      const qtd = comHora.filter((c) => periodoDe(horaDe(c.horario)) === p.key).length;
      return { ...p, qtd, pct: tot ? (qtd / tot) * 100 : 0 };
    });
  }, [comHora]);

  const porHora = useMemo(() => Array.from({ length: 24 }, (_, h) => {
    const rows = comHora.filter((c) => horaDe(c.horario) === h);
    return { h, label: `${h}h`, qtd: rows.length, valor: rows.reduce((s, c) => s + liquido(c), 0), periodo: periodoDe(h)!, noturna: ehNoturna(h) };
  }), [comHora]);

  const mensal = useMemo(() => {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const arr = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { ym, y: d.getFullYear(), m: d.getMonth(), label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, qtd: 0, valor: 0, atual: i === 11 };
    });
    facetadas.filter((c) => contaNoPainel(c, incluirPend)).forEach((c) => {
      const b = arr.find((x) => x.ym === c.data.slice(0, 7));
      if (b) { b.qtd += 1; b.valor += liquido(c); }
    });
    return arr.map((b, i) => ({ ...b, dValor: i ? pctDelta(b.valor, arr[i - 1].valor) : null, dQtd: i ? pctDelta(b.qtd, arr[i - 1].qtd) : null }));
  }, [facetadas, incluirPend, hoje]);

  const historico = useMemo(() => [...painel].sort((a, b) =>
    a.data === b.data ? (b.horario ?? "").localeCompare(a.horario ?? "") : b.data.localeCompare(a.data)).slice(0, 30), [painel]);

  const exportar = () => {
    const rows = painel.map((c) => ({
      Data: brData(c.data), Horário: c.horario ?? "", Colaborador: c.colaborador, Empresa: c.empresa ?? "",
      Origem: c.origem ?? "", Destino: c.destino ?? "", Motivo: c.motivo ?? "", Tipo: c.tipo ?? "",
      "Tipo de serviço (Uber)": c.servico_uber ?? "", "Valor (R$)": Number(c.valor || 0), "Reembolso (R$)": reembolsoDe(c),
      Pagamento: c.forma_pagamento ?? "", Responsável: c.responsavel ?? "", "Criado por": c.criado_por ?? "",
      Status: statusCorrida(c) === "pendente" ? "Pendente" : "Ativa",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Corridas");
    XLSX.writeFile(wb, `uber-corporativo-${ymd(new Date())}.xlsx`);
  };

  const presetAtivo = presets.find((p) => p.de === f.de && p.ate === f.ate)?.label;
  const chips: { label: string; onRemove: () => void }[] = [];
  const add = (k: Facet, label: string) => f[k] !== undefined && chips.push({ label, onRemove: () => setFacet(k, "all") });
  add("colab", `Colaborador: ${f.colab}`); add("motivo", `Motivo: ${f.motivo}`); add("tipo", `Tipo: ${f.tipo}`);
  add("empresa", `Empresa: ${f.empresa}`); add("criadoPor", `Criado por: ${f.criadoPor}`); add("servico", `Serviço: ${f.servico}`);
  add("periodo", `Período: ${PERIODOS.find((p) => p.key === f.periodo)?.label}`);
  add("dia", `Dia: ${f.dia !== undefined ? DIAS_SEMANA[f.dia] : ""}`); add("hora", `Hora: ${f.hora}h`);
  if (!presetAtivo) chips.unshift({ label: `Período: ${f.de ? brData(f.de) : "…"} a ${f.ate ? brData(f.ate) : "…"}`, onRemove: () => setF((p) => ({ ...p, de: presets[0].de, ate: presets[0].ate })) });

  const totalServ = servicos.reduce((s, x) => s + x.valor, 0);
  const maxHeat = Math.max(1, heat.pico.n);

  return (
    <TooltipProvider delayDuration={100}>
    <div className="container mx-auto p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/uber"><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Link></Button>
          <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Car className="h-6 w-6" /></div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Gestão de Mobilidade</div>
            <h1 className="text-2xl font-bold leading-tight">Uber Corporativo</h1>
            <p className="text-xs text-muted-foreground tabular-nums">{f.de && brData(f.de)} a {f.ate && brData(f.ate)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportar}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button asChild variant="outline" size="sm"><Link to="/uber"><Users className="h-4 w-4 mr-1" />Corridas</Link></Button>
          {canManageCorridas && <Button size="sm" onClick={() => setNovaOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova corrida</Button>}
        </div>
      </div>

      {/* Filtros */}
      <Card className="sticky top-2 z-20 p-3 space-y-3 backdrop-blur bg-card/95 border-border/60 shadow-sm rounded-2xl">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <Button key={p.label} size="sm" variant={presetAtivo === p.label ? "default" : "outline"} className="h-7 rounded-full text-xs"
              onClick={() => setF((x) => ({ ...x, de: p.de, ate: p.ate }))}>{p.label}</Button>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 items-end">
          <div className="lg:col-span-1"><Lbl>De</Lbl><Input type="date" value={f.de} onChange={(e) => setF((p) => ({ ...p, de: e.target.value }))} /></div>
          <div className="lg:col-span-1"><Lbl>Até</Lbl><Input type="date" value={f.ate} onChange={(e) => setF((p) => ({ ...p, ate: e.target.value }))} /></div>
          <Filtro className="lg:col-span-2" label="Colaborador" value={f.colab} onChange={(v) => setFacet("colab", v)} options={listas.colabs} />
          <Filtro className="lg:col-span-2" label="Motivo" value={f.motivo} onChange={(v) => setFacet("motivo", v)} options={MOTIVOS} />
          <Filtro className="lg:col-span-1" label="Tipo" value={f.tipo} onChange={(v) => setFacet("tipo", v)} options={TIPOS} />
          <Filtro className="lg:col-span-1" label="Serviço" value={f.servico} onChange={(v) => setFacet("servico", v)} options={[...listas.servicos, SEM_SERVICO]} />
          <Filtro className="lg:col-span-2" label="Empresa" value={f.empresa} onChange={(v) => setFacet("empresa", v)} options={listas.empresas} todas />
          <Filtro className="lg:col-span-1" label="Criado por" value={f.criadoPor} onChange={(v) => setFacet("criadoPor", v)} options={listas.criadores} />
          <Button variant="outline" size="sm" className="lg:col-span-1" onClick={limpar}>Limpar filtros</Button>
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <Badge key={c.label} variant="secondary" className="gap-1 pr-1 rounded-full">
                {c.label}
                <button aria-label={`Remover ${c.label}`} onClick={c.onRemove} className="rounded-full hover:bg-background/60 p-0.5"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Faixa de pendentes */}
      {!isLoading && pendTot.qtd > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm">
          <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="tabular-nums">
            <b>{fmtNum(pendTot.qtd)}</b> corridas pendentes ({fmtMoney(pendTot.liq)}) {incluirPend ? "incluídas neste painel" : "fora deste painel"}
          </span>
          <label className="flex items-center gap-2 text-xs ml-auto">Incluir <Switch checked={incluirPend} onCheckedChange={setIncluirPend} /></label>
          <Link className="text-xs font-semibold text-primary hover:underline" to={`/uber?status=pendente&de=${f.de}&ate=${f.ate}`}>Ver pendentes</Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Kpi icon={Car} label="Corridas" value={fmtNum(kpis.qtd)} sub={incluirPend ? "ativas + pendentes" : "ativas"} delta={kpis.dQtd} ant={kpis.antLabel} />
            <Kpi icon={DollarSign} label="Gasto líquido" value={fmtMoney(kpis.liq)} sub="após reembolsos" delta={kpis.dLiq} ant={kpis.antLabel} custo />
            <Kpi icon={TrendingUp} label="Ticket médio" value={fmtMoney(kpis.ticket)} sub="por corrida" delta={kpis.dTicket} ant={kpis.antLabel} custo />
            <Kpi icon={Receipt} label="Reembolsos" value={fmtMoney(kpis.reemb)} sub={`${fmtPct(kpis.bruto ? (kpis.reemb / kpis.bruto) * 100 : 0)} sobre bruto`} delta={kpis.dReemb} ant={kpis.antLabel} />
            <Kpi icon={Ban} label="Canceladas" value={fmtNum(kpis.cancel)} sub={`${fmtPct(kpis.cancelPct)} do total`} delta={kpis.dCancel} ant={kpis.antLabel} />
          </div>

          {/* Destaques */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-6 p-5 rounded-2xl border-border/60 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><Star className="h-6 w-6" /></div>
              {destaque ? (
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Colaborador em destaque</div>
                  <button className="text-lg font-bold truncate hover:underline text-left" onClick={() => toggleFacet("colab", destaque.nome)}>{destaque.nome}</button>
                  <div className="text-sm tabular-nums"><b className="text-2xl">{fmtMoney(destaque.valor)}</b>
                    <span className="text-muted-foreground"> · {fmtNum(destaque.qtd)} corridas · {fmtPct(kpis.liq ? (destaque.valor / kpis.liq) * 100 : 0)} do gasto</span></div>
                </div>
              ) : <Vazio texto="Nenhum colaborador identificado no período" />}
            </Card>
            <Card className="lg:col-span-6 p-5 rounded-2xl border-border/60 shadow-sm flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><MoonStar className="h-6 w-6" /></div>
              {noturnas.qtd > 0 ? (
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Corridas noturnas · 19h00 às 04h59</div>
                  <div className="text-sm tabular-nums"><b className="text-2xl">{fmtNum(noturnas.qtd)}</b> corridas
                    <span className="text-muted-foreground"> · {fmtMoney(noturnas.liq)} · {fmtPct(kpis.liq ? (noturnas.liq / kpis.liq) * 100 : 0)} do gasto</span></div>
                </div>
              ) : <div className="text-sm text-muted-foreground">Nenhuma corrida noturna no período</div>}
            </Card>
          </div>

          {/* a + b */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Bloco className="lg:col-span-8" titulo="Mapa de calor" sub="Corridas por dia da semana e hora — clique para filtrar"
              nota={semHora > 0 ? `${fmtNum(semHora)} corridas sem horário não aparecem neste gráfico` : undefined}>
              {comHora.length === 0 ? <Vazio texto="Sem corridas com horário no período" /> : (
                <>
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0,1fr)) 44px" }}>
                        <div />
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className={`text-[9px] text-center text-muted-foreground tabular-nums rounded-sm ${ehNoturna(h) ? "bg-muted" : ""}`}>{h}</div>
                        ))}
                        <div className="text-[9px] text-right text-muted-foreground">Total</div>
                        {heat.g.map((row, d) => (
                          <Fragment key={d}>
                            <div key={`l${d}`} className="text-[10px] text-muted-foreground font-medium self-center">{DIAS_SEMANA[d]}</div>
                            {row.map((n, h) => {
                              const sel = f.dia === d && f.hora === h;
                              return (
                                <Tooltip key={`${d}-${h}`}>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => setF((p) => (p.dia === d && p.hora === h ? { ...p, dia: undefined, hora: undefined } : { ...p, dia: d, hora: h }))}
                                      className={`h-7 rounded-[4px] text-[9px] tabular-nums transition-transform hover:scale-110 ${sel ? "ring-2 ring-foreground" : ""} ${n / maxHeat > 0.55 ? "text-primary-foreground" : "text-foreground"}`}
                                      style={{ background: n ? verde(0.12 + 0.88 * (n / maxHeat)) : "hsl(var(--muted) / 0.5)" }}
                                    >{n || ""}</button>
                                  </TooltipTrigger>
                                  <TooltipContent>{DIAS_SEMANA[d]}, {h}h: {fmtNum(n)} corridas</TooltipContent>
                                </Tooltip>
                              );
                            })}
                            <div key={`t${d}`} className="text-[10px] text-right font-semibold tabular-nums self-center">{fmtNum(row.reduce((s, n) => s + n, 0))}</div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Pico: <b className="text-foreground">{DIAS_SEMANA[heat.pico.d]}, {heat.pico.h}h, {fmtNum(heat.pico.n)} corridas</b> · sombreado no cabeçalho = horário noturno</div>
                </>
              )}
            </Bloco>
            <Bloco className="lg:col-span-4" titulo="Corridas por período do dia" sub="Clique para filtrar">
              <div className="grid grid-cols-2 gap-3">
                {porPeriodo.map((p) => {
                  const Icon = PERIODO_ICON[p.key];
                  const sel = f.periodo === p.key;
                  return (
                    <button key={p.key} onClick={() => toggleFacet("periodo", p.key)}
                      className={`text-left rounded-xl border p-3 transition-colors hover:bg-muted/40 ${sel ? "border-primary bg-primary/5" : "border-border/60"}`}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{p.label}</div>
                      <div className="text-[10px] text-muted-foreground">{p.range}</div>
                      <div className="mt-1 text-2xl font-bold tabular-nums">{fmtNum(p.qtd)}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{fmtPct(p.pct)} do total</div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all duration-500" style={{ width: `${p.pct}%` }} /></div>
                    </button>
                  );
                })}
              </div>
            </Bloco>
          </div>

          {/* c + d */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Bloco className="lg:col-span-8" titulo="Evolução mensal" sub="Últimos 12 meses · barras = gasto líquido, linha = corridas · clique no mês para filtrar">
              <ResponsiveContainer width="100%" height={290}>
                <ComposedChart data={mensal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  onClick={(e: any) => { const m = e?.activePayload?.[0]?.payload; if (m) setF((p) => ({ ...p, de: ymd(new Date(m.y, m.m, 1)), ate: ymd(new Date(m.y, m.m + 1, 0)) })); }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="v" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${Math.round(v / 1000)} mil`} width={70} />
                  <YAxis yAxisId="q" orientation="right" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={36} />
                  <RTooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} content={<MesTip />} />
                  <Bar yAxisId="v" dataKey="valor" radius={[6, 6, 0, 0]} className="cursor-pointer">
                    {mensal.map((m) => <Cell key={m.ym} fill={m.atual ? verde(0.45) : verde(0.85)} stroke={m.atual ? "hsl(var(--primary))" : undefined} strokeDasharray={m.atual ? "4 3" : undefined} />)}
                  </Bar>
                  <Line yAxisId="q" type="monotone" dataKey="qtd" stroke="hsl(var(--foreground) / 0.7)" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="text-[11px] text-muted-foreground">Barra tracejada = {mensal[11].label} (em andamento)</div>
            </Bloco>
            <Bloco className="lg:col-span-4" titulo="Gasto por tipo de viagem" sub="Tipo de serviço Uber · clique para filtrar">
              {servicos.length === 0 ? <Vazio texto="Sem corridas no período" /> : (
                <>
                  <div className="relative h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={servicos} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={82} paddingAngle={2} stroke="none"
                          onClick={(d: any) => toggleFacet("servico", d.nome)} className="cursor-pointer">
                          {servicos.map((s, i) => <Cell key={s.nome} fill={s.naoInformado ? CINZA : verde(Math.max(0.25, 1 - i * 0.14))} />)}
                        </Pie>
                        <RTooltip formatter={(v: any, n: any) => [fmtMoney(Number(v)), n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-[10px] text-muted-foreground">Total</div>
                      <div className="text-sm font-bold tabular-nums">{fmtMoney(totalServ)}</div>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {servicos.map((s, i) => (
                      <button key={s.nome} onClick={() => toggleFacet("servico", s.nome)}
                        className={`w-full flex items-center gap-2 text-xs rounded-md px-1.5 py-1 hover:bg-muted/50 ${f.servico === s.nome ? "bg-primary/10" : ""}`}>
                        <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.naoInformado ? CINZA : verde(Math.max(0.25, 1 - i * 0.14)) }} />
                        <span className={`truncate ${s.naoInformado ? "text-muted-foreground" : ""}`}>{s.nome}</span>
                        <span className="ml-auto tabular-nums whitespace-nowrap">{fmtMoney(s.valor)} · {fmtNum(s.qtd)} · <span className="text-muted-foreground">{fmtPct(totalServ ? (s.valor / totalServ) * 100 : 0)}</span></span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Bloco>
          </div>

          {/* e + f */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Bloco className="lg:col-span-7" titulo="Viagens por hora" sub="0h a 23h · tom escuro = noturno (19h–04h59) · clique para filtrar"
              nota={semHora > 0 ? `${fmtNum(semHora)} corridas sem horário não aparecem neste gráfico` : undefined}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porHora} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} onClick={(e: any) => { const p = e?.activePayload?.[0]?.payload; if (p) toggleFacet("hora", p.h); }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RTooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: any) => [fmtNum(Number(v)), "Corridas"]} />
                  <Bar dataKey="qtd" radius={[4, 4, 0, 0]} className="cursor-pointer">
                    {porHora.map((p) => <Cell key={p.h} fill={p.noturna ? verde(1) : verde(PERIODO_TOM[p.periodo])} stroke={f.hora === p.h ? "hsl(var(--foreground))" : undefined} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Bloco>
            <Bloco className="lg:col-span-5" titulo="Ranking de empresas atendidas" sub="Top 10 por gasto líquido · clique para filtrar" icon={Building2}>
              <Ranking linhas={empresas.slice(0, 10)} sel={f.empresa} onPick={(n) => toggleFacet("empresa", n)} />
            </Bloco>
          </div>

          {/* g */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Bloco className="lg:col-span-6" titulo="Principais colaboradores" sub="Top 10 por gasto líquido · clique para filtrar" icon={Users}>
              <Ranking linhas={colabs.slice(0, 10)} sel={f.colab} onPick={(n) => toggleFacet("colab", n)} />
            </Bloco>
            <Bloco className="lg:col-span-6" titulo="Distribuição por motivo" sub="Gasto líquido e nº de corridas · clique para filtrar">
              <Ranking linhas={motivos} sel={f.motivo} onPick={(n) => toggleFacet("motivo", n)} />
            </Bloco>
          </div>

          {/* h */}
          <Card className="p-0 overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <div className="p-5 pb-3">
              <div className="text-sm font-semibold">Histórico recente</div>
              <div className="text-xs text-muted-foreground">Últimas 30 corridas do período filtrado</div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Colaborador</TableHead><TableHead>Empresa</TableHead>
                  <TableHead>Trajeto</TableHead><TableHead>Motivo</TableHead><TableHead>Tipo</TableHead><TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Reembolso</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {historico.length === 0 && <TableRow><TableCell colSpan={12} className="py-8"><Vazio texto="Nenhuma corrida no período" /></TableCell></TableRow>}
                  {historico.map((c) => {
                    const r = reembolsoDe(c);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="tabular-nums">{brData(c.data)}</TableCell>
                        <TableCell className="tabular-nums">{c.horario?.slice(0, 5) ?? "—"}</TableCell>
                        <TableCell className="font-medium">{c.colaborador || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={c.empresa ?? ""}>{c.empresa || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[220px] truncate" title={`${c.origem ?? ""} → ${c.destino ?? ""}`}>{c.origem || "—"} → {c.destino || "—"}</TableCell>
                        <TableCell className="text-xs">{c.motivo || "—"}</TableCell>
                        <TableCell className="text-xs">{c.tipo || "—"}</TableCell>
                        <TableCell className="text-xs">{c.servico_uber || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{fmtMoney(Number(c.valor || 0))}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r > 0 ? fmtMoney(r) : "—"}</TableCell>
                        <TableCell className="text-xs">{c.forma_pagamento || "—"}</TableCell>
                        <TableCell>{statusCorrida(c) === "pendente"
                          ? <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40">Pendente</Badge>
                          : <Badge className="bg-primary/15 text-primary border-primary/30">Ativa</Badge>}</TableCell>
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
    </TooltipProvider>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">{children}</div>;
}

function Filtro({ label, value, onChange, options, todas, className }: { label: string; value?: string; onChange: (v: string) => void; options: string[]; todas?: boolean; className?: string }) {
  return (
    <div className={className}><Lbl>{label}</Lbl>
      <Select value={value ?? "all"} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="all">{todas ? "Todas" : "Todos"}</SelectItem>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <div className="flex flex-col items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Inbox className="h-6 w-6 opacity-60" />{texto}</div>;
}

function Bloco({ titulo, sub, nota, icon: Icon, className, children }: { titulo: string; sub?: string; nota?: string; icon?: any; className?: string; children: React.ReactNode }) {
  return (
    <Card className={`p-5 rounded-2xl border-border/60 shadow-sm min-w-0 ${className ?? ""}`}>
      <div className="flex items-start justify-between mb-4">
        <div><div className="text-sm font-semibold">{titulo}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      {children}
      {nota && <div className="mt-2 text-[11px] text-muted-foreground">{nota}</div>}
    </Card>
  );
}

function Ranking({ linhas, sel, onPick }: { linhas: { nome: string; qtd: number; valor: number; naoInformado: boolean }[]; sel?: string; onPick: (n: string) => void }) {
  if (!linhas.length) return <Vazio texto="Sem dados no período" />;
  const max = Math.max(1, ...linhas.filter((l) => !l.naoInformado).map((l) => l.valor), ...linhas.map((l) => l.valor));
  return (
    <div className="space-y-2">
      {linhas.map((l, i) => (
        <button key={l.nome} onClick={() => onPick(l.nome)} className={`w-full text-left rounded-md px-1.5 py-1 hover:bg-muted/40 ${sel === l.nome ? "bg-primary/10" : ""}`}>
          <div className="flex items-center justify-between text-xs mb-1 gap-2">
            <span className={`truncate ${l.naoInformado ? "text-muted-foreground italic" : "font-medium"}`} title={l.nome}>{l.naoInformado ? "" : `${i + 1}. `}{l.nome}</span>
            <span className="tabular-nums whitespace-nowrap"><b>{fmtMoney(l.valor)}</b> <span className="text-muted-foreground">· {fmtNum(l.qtd)}</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full transition-all duration-500" style={{ width: `${(l.valor / max) * 100}%`, background: l.naoInformado ? CINZA : verde(Math.max(0.4, 1 - i * 0.06)) }} />
          </div>
        </button>
      ))}
    </div>
  );
}

function MesTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  const d = (v: number | null) => (v === null ? "—" : `${v >= 0 ? "+" : ""}${fmtPct(v)}`);
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md tabular-nums">
      <div className="font-semibold mb-1">{m.label}{m.atual ? " (em andamento)" : ""}</div>
      <div>Gasto líquido: <b>{fmtMoney(m.valor)}</b> <span className="text-muted-foreground">({d(m.dValor)})</span></div>
      <div>Corridas: <b>{fmtNum(m.qtd)}</b> <span className="text-muted-foreground">({d(m.dQtd)})</span></div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, delta, ant, custo }: { icon: any; label: string; value: string; sub: string; delta: number | null; ant: string; custo?: boolean }) {
  const cor = delta === null || delta === 0 || !custo ? "text-muted-foreground" : delta > 0 ? "text-amber-600 dark:text-amber-400" : "text-primary";
  const Arrow = (delta ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card className="p-4 rounded-2xl border-border/60 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${cor}`}>
              {delta === null ? "—" : <><Arrow className="h-3 w-3" />{fmtPct(Math.abs(delta))}</>}
            </span>
          </TooltipTrigger>
          <TooltipContent>Comparado a {ant}</TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs font-semibold">{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </Card>
  );
}
