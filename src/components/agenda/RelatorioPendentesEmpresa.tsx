import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { AlertTriangle, Clock, Download, Printer, Search, TrendingUp, Users, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { isoParaBr, listarProcedimentosPendentes, listarProcedimentosPendentesDireto } from "@/lib/agendaCirurgicaApi";
import { celulaCsvSegura, correspondeStatus, formatarCnpjAgenda, formatarDataAgenda, linhasPendentes, metricasPendentes, StatusPendente, tomDias } from "@/lib/agenda-pendentes";
import { printRelatorioPendentes } from "./RelatorioPendentesReport";

const inicial = () => { const d = new Date(); const hoje = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; return { ini: hoje, fim: hoje, procedimento: "" }; };
const cores = { danger: "text-destructive border-destructive/30 bg-destructive/10", warning: "text-warning border-warning/30 bg-warning/10", success: "text-success border-success/30 bg-success/10" };

export function RelatorioPendentesEmpresa({ direto = false, chave = "", servidorUrl = "" }: { direto?: boolean; chave?: string; servidorUrl?: string }) {
  const { user } = useAuth();
  const [form, setForm] = useState(inicial);
  const [aplicado, setAplicado] = useState(inicial);
  const [empresa, setEmpresa] = useState("todas");
  const [status, setStatus] = useState<StatusPendente>("todos");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const q = useQuery({
    queryKey: ["agenda-pendentes", direto ? `direto:${servidorUrl}` : "servidor", aplicado],
    queryFn: () => {
      const f = { dt_inicio: isoParaBr(aplicado.ini), dt_final: isoParaBr(aplicado.fim), cd_cgc: "0", cd_procedimento: aplicado.procedimento || "0" };
      return direto ? listarProcedimentosPendentesDireto(f, chave) : listarProcedimentosPendentes(f);
    },
    enabled: !!user && (!direto || !!chave), retry: false,
  });
  const dados = q.data?.dados ?? [];
  const empresas = useMemo(() => [...new Set(dados.map(d => d.empresa).filter(Boolean))].sort((a,b) => a.localeCompare(b)), [dados]);
  const visiveis = dados.filter(d => (empresa === "todas" || d.empresa === empresa) && correspondeStatus(d.dias_para_execucao, status) && d.nm_paciente?.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const metricas = metricasPendentes(visiveis);
  const paginas = Math.max(1, Math.ceil(visiveis.length / 50));
  const atual = Math.min(pagina, paginas);
  const media = q.data?.media_dias_geral || "—";
  const aplicar = () => { if (!form.ini || !form.fim || form.ini > form.fim) { toast.error("Informe um período válido."); return; } if (form.procedimento && !/^\d+$/.test(form.procedimento)) { toast.error("Informe apenas números no código do procedimento."); return; } setPagina(1); if (JSON.stringify(form) === JSON.stringify(aplicado)) void q.refetch(); else setAplicado({...form}); };
  const limpar = () => { const f = inicial(); setForm(f); setAplicado(f); setEmpresa("todas"); setStatus("todos"); setBusca(""); setPagina(1); };
  const exportar = (tipo: "csv" | "xlsx") => {
    const rows = linhasPendentes(visiveis);
    if (tipo === "xlsx") { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Pendentes"); XLSX.writeFile(wb, `pendentes_${aplicado.ini}_${aplicado.fim}.xlsx`); return; }
    const csv = [Object.keys(rows[0] ?? {}).map(celulaCsvSegura).join(";"), ...rows.map(r => Object.values(r).map(celulaCsvSegura).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `pendentes_${aplicado.ini}_${aplicado.fim}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const bloqueado = !visiveis.length || q.isFetching || !!q.error;
  return <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div><Label htmlFor="pend-ini">Data Início</Label><Input id="pend-ini" type="date" value={form.ini} onChange={e => setForm({...form, ini:e.target.value})}/></div>
      <div><Label htmlFor="pend-fim">Data Fim</Label><Input id="pend-fim" type="date" value={form.fim} onChange={e => setForm({...form, fim:e.target.value})}/></div>
      <div><Label>Empresa</Label><Select value={empresa} onValueChange={v => {setEmpresa(v);setPagina(1);}}><SelectTrigger aria-label="Empresa"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem>{empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select></div>
      <div><Label htmlFor="pend-proc">Código do Procedimento</Label><Input id="pend-proc" inputMode="numeric" value={form.procedimento} onChange={e => setForm({...form, procedimento:e.target.value})}/></div>
      <div><Label>Status</Label><Select value={status} onValueChange={v => {setStatus(v as StatusPendente);setPagina(1);}}><SelectTrigger aria-label="Status dos pendentes"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="risco">Em Risco (0 a 2d)</SelectItem><SelectItem value="vencidos">Vencidos</SelectItem><SelectItem value="prazo">No Prazo (&gt; 2d)</SelectItem></SelectContent></Select></div>
    </div>
    <div className="flex gap-2 justify-end"><Button variant="outline" onClick={limpar}><RotateCcw className="h-4 w-4 mr-2"/>Limpar</Button><Button onClick={aplicar} disabled={q.isFetching}><Search className="h-4 w-4 mr-2"/>{q.isFetching ? "Consultando..." : "Filtrar"}</Button></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[{label:"Total Pendentes",value:metricas.total,icon:Users},{label:"Média Histórica",value:media,icon:TrendingUp},{label:"Próximo a Vencer",value:metricas.proximo === null ? "—" : `${metricas.proximo} Dias`,icon:Clock},{label:"Em Risco (≤ 2d)",value:metricas.risco,icon:AlertTriangle}].map((m,i) => <Card key={m.label} className="rounded-lg"><CardContent className="p-4"><div className="flex justify-between gap-2 text-sm text-muted-foreground"><span>{m.label}</span><m.icon className={`h-4 w-4 shrink-0 ${i===3 ? "text-destructive" : ""}`}/></div><div className={`mt-2 text-2xl font-semibold break-words ${i===3 ? "text-destructive" : ""}`}>{q.isLoading ? "—" : m.value}</div></CardContent></Card>)}</div>
    <div className="flex items-center justify-between gap-3 flex-wrap"><Input className="max-w-sm" aria-label="Buscar paciente" placeholder="Buscar paciente..." value={busca} onChange={e => {setBusca(e.target.value);setPagina(1);}}/><div className="flex gap-2 flex-wrap"><Button variant="outline" disabled={bloqueado} onClick={() => exportar("csv")}><Download className="h-4 w-4 mr-2"/>Exportar CSV</Button><Button variant="outline" disabled={bloqueado} onClick={() => exportar("xlsx")}><Download className="h-4 w-4 mr-2"/>Exportar Excel</Button><Button variant="outline" disabled={bloqueado} onClick={() => {try {printRelatorioPendentes({dados:visiveis, filtros:`${isoParaBr(aplicado.ini)} a ${isoParaBr(aplicado.fim)} · Empresa: ${empresa} · Procedimento: ${aplicado.procedimento || "Todos"} · Status: ${status} · Paciente: ${busca || "Todos"}`,mediaDias:media,total:visiveis.length});} catch(e) {toast.error((e as Error).message);}}}><Printer className="h-4 w-4 mr-2"/>Imprimir</Button></div></div>
    {q.error ? <div role="alert" className="border border-destructive/30 rounded-md p-4 text-destructive">{(q.error as Error).message}</div> : <div className="border rounded-md overflow-hidden"><Table><TableHeader><TableRow>{["Paciente","Procedimento","Empresa","CNPJ","Data Agendada","Agendado em","Dias p/ Execução","Atendimento"].map(c => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{q.isLoading ? <TableRow><TableCell colSpan={8}>Consultando procedimentos...</TableCell></TableRow> : !visiveis.length ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum procedimento encontrado.</TableCell></TableRow> : visiveis.slice((atual-1)*50,atual*50).map((d,i) => <TableRow key={`${d.cd_pessoa_fisica}-${d.cd_procedimento}-${i}`}><TableCell>{d.nm_paciente}</TableCell><TableCell>{d.cd_procedimento} - {d.ds_procedimento}</TableCell><TableCell>{d.empresa}</TableCell><TableCell className="whitespace-nowrap">{formatarCnpjAgenda(d.cd_cgc_estipulante)}</TableCell><TableCell className="whitespace-nowrap">{formatarDataAgenda(d.dt_agenda,true)}</TableCell><TableCell>{formatarDataAgenda(d.dt_agendamento)}</TableCell><TableCell><Badge variant="outline" className={cores[tomDias(d.dias_para_execucao)]}>{d.dias_para_execucao} dias</Badge></TableCell><TableCell>{d.nr_atendimento ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>}
    <div className="flex justify-end gap-2 items-center flex-wrap"><span className="text-sm text-muted-foreground">{visiveis.length} registros · Página {atual} de {paginas}</span><Button variant="outline" disabled={atual<=1} onClick={() => setPagina(atual-1)}>Anterior</Button><Button variant="outline" disabled={atual>=paginas} onClick={() => setPagina(atual+1)}>Próxima</Button></div>
  </div>;
}