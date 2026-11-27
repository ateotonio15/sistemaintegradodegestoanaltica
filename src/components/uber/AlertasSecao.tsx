import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Download, Settings, X } from "lucide-react";
import type { UberCorrida } from "@/hooks/useUberCorridas";
import { ALERTA_INFO, ALERTA_ORDEM, type AlertaTipo, type AlertasConfig, type CorridaAlerta, type RotaRepetida } from "@/lib/uber-alertas";
import { statusCorrida } from "@/lib/uber-dashboard";
import { ConfigAlertasDialog } from "./ConfigAlertasDialog";

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const POR_PAGINA = 15;

export function chipClasse(t: AlertaTipo) {
  return ALERTA_INFO[t].grave
    ? "bg-destructive/10 text-destructive border-destructive/30"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30";
}
const rotuloAlerta = (t: AlertaTipo, a: CorridaAlerta) =>
  t === "fds" && a.feriado ? `Feriado: ${a.feriado}` : t === "fds" ? "Fim de semana" : ALERTA_INFO[t].label;
const trajeto = (c: UberCorrida) => `${c.origem || "—"} → ${c.destino || "—"}`;

export function AlertasSecao({ alertas, repetidas, config, rotaSel, onRotaSel, onAbrir }: {
  alertas: CorridaAlerta[]; repetidas: RotaRepetida[]; config: AlertasConfig;
  rotaSel: string | null; onRotaSel: (k: string | null) => void; onAbrir: (c: UberCorrida) => void;
}) {
  const [tipo, setTipo] = useState<AlertaTipo | "all">("all");
  const [pag, setPag] = useState(0);
  const [cfgOpen, setCfgOpen] = useState(false);

  const resumo = useMemo(() => ALERTA_ORDEM.map((t) => {
    const rows = alertas.filter((a) => a.alertas.includes(t));
    return { t, qtd: rows.length, valor: rows.reduce((s, a) => s + Number(a.corrida.valor || 0), 0) };
  }), [alertas]);

  const lista = useMemo(() => alertas.filter((a) =>
    (tipo === "all" || a.alertas.includes(tipo)) && (!rotaSel || a.rota?.chave === rotaSel)), [alertas, tipo, rotaSel]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pagina = Math.min(pag, paginas - 1);
  const rotaRotulo = repetidas.find((r) => r.chave === rotaSel)?.rotulo ?? alertas.find((a) => a.rota?.chave === rotaSel)?.rota?.rotulo;

  const exportar = () => {
    const rows = lista.map((a) => ({
      Data: br(a.corrida.data), Hora: a.corrida.horario?.slice(0, 5) ?? "", Colaborador: a.corrida.colaborador || "",
      Empresa: a.corrida.empresa || "", Rota: trajeto(a.corrida), "Valor (R$)": Number(a.corrida.valor || 0),
      Alertas: a.alertas.map((t) => rotuloAlerta(t, a)).join("; "), Status: statusCorrida(a.corrida) === "pendente" ? "Pendente" : "Ativa",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Alertas");
    XLSX.writeFile(wb, "uber-alertas.xlsx");
  };

  return (
    <section id="alertas-uber" className="space-y-4 scroll-mt-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /><h2 className="text-base font-semibold">Alertas</h2>
          <span className="text-xs text-muted-foreground">corridas ativas e pendentes</span></div>
        <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}><Settings className="h-4 w-4 mr-1" />Configurar alertas</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {resumo.map((r) => {
          const sel = tipo === r.t;
          const vazio = r.qtd === 0;
          const tom = ALERTA_INFO[r.t].grave ? "text-destructive" : "text-amber-600 dark:text-amber-400";
          return (
            <button key={r.t} onClick={() => { setTipo(sel ? "all" : r.t); setPag(0); }}
              className={`text-left rounded-2xl border p-4 transition-colors bg-card shadow-sm hover:bg-muted/30 ${sel ? "border-primary ring-1 ring-primary" : "border-border/60"} ${vazio ? "opacity-60" : ""}`}>
              <div className={`text-xs font-semibold ${vazio ? "text-muted-foreground" : tom}`}>{ALERTA_INFO[r.t].label}</div>
              {vazio ? <div className="mt-2 text-sm text-muted-foreground">Nenhum alerta</div> : (
                <><div className="mt-1 text-2xl font-bold tabular-nums">{r.qtd.toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(r.valor)}</div></>
              )}
            </button>
          );
        })}
      </div>

      <Card className="p-0 overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <div className="p-5 pb-3 flex flex-wrap items-center gap-2">
          <div className="mr-auto"><div className="text-sm font-semibold">Corridas com alerta</div>
            <div className="text-xs text-muted-foreground">{lista.length.toLocaleString("pt-BR")} corridas · mais recentes primeiro · clique na linha para editar</div></div>
          {rotaSel && <Badge variant="secondary" className="gap-1 pr-1 rounded-full">Rota: {rotaRotulo}
            <button aria-label="Remover filtro de rota" onClick={() => onRotaSel(null)} className="p-0.5"><X className="h-3 w-3" /></button></Badge>}
          <Select value={tipo} onValueChange={(v) => { setTipo(v as any); setPag(0); }}>
            <SelectTrigger className="w-[210px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os alertas</SelectItem>{ALERTA_ORDEM.map((t) => <SelectItem key={t} value={t}>{ALERTA_INFO[t].label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!lista.length}><Download className="h-4 w-4 mr-1" />Exportar alertas</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Hora</TableHead><TableHead>Colaborador</TableHead><TableHead>Empresa</TableHead>
              <TableHead>Rota</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Alertas</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lista.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma corrida com alerta no período</TableCell></TableRow>}
              {lista.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA).map((a) => (
                <TableRow key={a.corrida.id} className="cursor-pointer" onClick={() => onAbrir(a.corrida)}>
                  <TableCell className="tabular-nums">{br(a.corrida.data)}</TableCell>
                  <TableCell className="tabular-nums">{a.corrida.horario?.slice(0, 5) ?? "—"}</TableCell>
                  <TableCell className="font-medium">{a.corrida.colaborador || "—"}</TableCell>
                  <TableCell className="max-w-[160px] truncate" title={a.corrida.empresa ?? ""}>{a.corrida.empresa || "—"}</TableCell>
                  <TableCell className="max-w-[240px]">
                    <Tooltip><TooltipTrigger asChild><span className="block truncate text-xs">{trajeto(a.corrida)}</span></TooltipTrigger>
                      <TooltipContent className="max-w-md">{trajeto(a.corrida)}</TooltipContent></Tooltip>
                    {a.rota?.incompleto && <span className="text-[10px] text-muted-foreground">endereço incompleto</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{fmtMoney(Number(a.corrida.valor || 0))}
                    {a.mediaRota !== null && a.alertas.includes("rota_preco") && <div className="text-[10px] font-normal text-muted-foreground">média {fmtMoney(a.mediaRota)}</div>}</TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{a.alertas.map((t) => <Badge key={t} variant="outline" className={`text-[10px] ${chipClasse(t)}`}>{rotuloAlerta(t, a)}</Badge>)}</div></TableCell>
                  <TableCell>{statusCorrida(a.corrida) === "pendente"
                    ? <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40">Pendente</Badge>
                    : <Badge className="bg-primary/15 text-primary border-primary/30">Ativa</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {paginas > 1 && (
          <div className="flex items-center justify-end gap-2 p-3 text-xs text-muted-foreground">
            Página {pagina + 1} de {paginas}
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPag(pagina - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={pagina >= paginas - 1} onClick={() => setPag(pagina + 1)}>Próxima</Button>
          </div>
        )}
      </Card>

      <Card className="p-0 overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <div className="p-5 pb-3"><div className="text-sm font-semibold">Rotas repetidas</div>
          <div className="text-xs text-muted-foreground">{config.repetida_min} ou mais vezes no período · ida e volta contam como a mesma rota</div></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Rota</TableHead><TableHead className="text-right">Vezes</TableHead><TableHead className="text-right">Valor total</TableHead>
              <TableHead>Colaboradores</TableHead><TableHead>Sugestão</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {repetidas.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma rota recorrente no período</TableCell></TableRow>}
              {repetidas.map((r) => (
                <TableRow key={r.chave}>
                  <TableCell className="max-w-[320px]"><div className="truncate font-medium" title={r.rotulo}>{r.rotulo}</div>
                    {r.incompleto && <div className="text-[10px] text-muted-foreground">endereço incompleto</div>}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{r.qtd}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(r.valor)}</TableCell>
                  <TableCell className="text-xs max-w-[220px]">{r.colaboradores.length ? r.colaboradores.join(", ") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">Avaliar transporte fixo ou outra alternativa</TableCell>
                  <TableCell><button className="text-xs font-semibold text-primary hover:underline whitespace-nowrap" onClick={() => { onRotaSel(r.chave); setTipo("all"); setPag(0);
                    document.getElementById("alertas-uber")?.scrollIntoView({ behavior: "smooth" }); }}>Ver corridas</button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <ConfigAlertasDialog open={cfgOpen} onOpenChange={setCfgOpen} config={config} />
    </section>
  );
}
