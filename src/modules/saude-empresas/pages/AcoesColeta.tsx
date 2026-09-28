import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, isToday, startOfMonth, startOfWeek, endOfWeek, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import { ChevronLeft, ChevronRight, Plus, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useEmpresasAtivas } from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { ColetaAgendamento, ColetaStatus, fmtHora, useColetaAgendamentos, useColetaMutations } from "../hooks/useColeta";
import { ColetaDetalheSheet } from "../components/ColetaDetalheSheet";

const COR: Record<ColetaStatus, string> = {
  agendada: "bg-sky-500/10 border-l-4 border-sky-500 hover:bg-sky-500/20",
  pendente: "bg-orange-500/10 border-l-4 border-orange-500 hover:bg-orange-500/20",
  concluida: "bg-emerald-500/10 border-l-4 border-emerald-500 hover:bg-emerald-500/20",
  cancelada: "bg-muted border-l-4 border-border opacity-60",
};
const STATUS_LABEL: Record<ColetaStatus, string> = { agendada: "Agendada", pendente: "A definir", concluida: "Concluída", cancelada: "Cancelada" };
const iso = (d: Date) => format(d, "yyyy-MM-dd");

type Form = Partial<ColetaAgendamento>;

export default function AcoesColeta() {
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const from = iso(startOfMonth(mes)), to = iso(endOfMonth(mes));
  const { data: ags = [] } = useColetaAgendamentos(from, to);
  const { data: empresas = [] } = useEmpresasAtivas();
  const m = useColetaMutations();
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const detalhe = ags.find((a) => a.id === detalheId) ?? null;

  const dias = useMemo(
    () => eachDayOfInterval({ start: startOfWeek(startOfMonth(mes), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(mes), { weekStartsOn: 1 }) })
      .filter((d) => d.getDay() !== 0 && d.getDay() !== 6),
    [mes],
  );

  const stats = useMemo(() => {
    let insc = 0, real = 0, falt = 0;
    const porEmpresa = new Map<string, { nome: string; acoes: number; insc: number; real: number; falt: number }>();
    ags.forEach((a) => {
      const i = (a.inscricoes ?? []).filter((x) => x.status !== "cancelada").length;
      const r = (a.inscricoes ?? []).filter((x) => x.status === "realizada").length;
      const f = (a.inscricoes ?? []).filter((x) => x.status === "faltou").length;
      insc += i; real += r; falt += f;
      const e = porEmpresa.get(a.empresa_id) ?? { nome: a.empresa?.nome ?? "—", acoes: 0, insc: 0, real: 0, falt: 0 };
      e.acoes++; e.insc += i; e.real += r; e.falt += f;
      porEmpresa.set(a.empresa_id, e);
    });
    return { insc, real, falt, taxa: insc ? Math.round((real / insc) * 100) : 0, porEmpresa: [...porEmpresa.values()].sort((a, b) => a.nome.localeCompare(b.nome)) };
  }, [ags]);

  const salvar = () => {
    if (!form?.empresa_id || !form.data) return toast.error("Informe empresa e data");
    const payload: any = {
      id: form.id, empresa_id: form.empresa_id, data: form.data,
      horario_inicio: form.horario_inicio || null, horario_fim: form.horario_fim || null,
      responsavel: form.responsavel?.trim() || null, local: form.local?.trim() || null,
      vagas: form.vagas ? Number(form.vagas) : null, observacoes: form.observacoes?.trim() || null,
      status: form.status ?? "agendada", data_limite: form.data_limite || null,
    };
    m.salvarAgendamento.mutate(payload, { onSuccess: () => setForm(null) });
  };

  const exportarMes = () => {
    const rows = stats.porEmpresa.map((e) => ({ Empresa: e.nome, Ações: e.acoes, Inscritas: e.insc, Realizadas: e.real, Faltas: e.falt,
      "Comparecimento (%)": e.insc ? Math.round((e.real / e.insc) * 100) : 0 }));
    const det = ags.map((a) => ({ Data: format(new Date(a.data + "T00:00"), "dd/MM/yyyy"), Empresa: a.empresa?.nome, Início: fmtHora(a.horario_inicio),
      Fim: fmtHora(a.horario_fim), Responsável: a.responsavel ?? "", Local: a.local ?? "", Status: STATUS_LABEL[a.status],
      Inscritas: (a.inscricoes ?? []).filter((x) => x.status !== "cancelada").length, Realizadas: (a.inscricoes ?? []).filter((x) => x.status === "realizada").length }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Por empresa");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det), "Agendamentos");
    XLSX.writeFile(wb, `coletas-${format(mes, "yyyy-MM")}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Ações de Coleta (Preventivo)</h1>
          <p className="text-sm text-muted-foreground">Agendamentos, inscrições pelo link e confirmação das coletas.</p>
        </div>
        <Button onClick={() => setForm({ status: "agendada" })}><Plus className="h-4 w-4 mr-1" />Novo agendamento</Button>
      </div>

      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" onClick={() => setMes(addMonths(mes, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" onClick={() => setMes(startOfMonth(new Date()))}>Hoje</Button>
        <Button size="icon" variant="outline" onClick={() => setMes(addMonths(mes, 1))}><ChevronRight className="h-4 w-4" /></Button>
        <span className="font-medium capitalize ml-2">{format(mes, "MMMM 'de' yyyy", { locale: ptBR })}</span>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList><TabsTrigger value="calendario">Calendário</TabsTrigger><TabsTrigger value="dashboard">Dashboard</TabsTrigger></TabsList>

        <TabsContent value="calendario">
          <Card className="p-2 overflow-x-auto">
            <div className="grid grid-cols-5 gap-1 min-w-[700px]">
              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((d) => <div key={d} className="text-xs font-medium text-muted-foreground p-2">{d}</div>)}
              {dias.map((d) => {
                const fer = feriadoEm(d);
                const doDia = ags.filter((a) => a.data === iso(d));
                return (
                  <div key={iso(d)} className={`min-h-[110px] rounded-md border border-border p-1.5 space-y-1 ${!isSameMonth(d, mes) ? "opacity-40" : ""} ${fer ? "bg-destructive/5" : ""}`}>
                    <div className={`text-xs font-medium ${isToday(d) ? "text-primary" : ""}`}>{format(d, "d")}</div>
                    {fer && <div className="text-[10px] text-destructive leading-tight">Feriado · {fer.nome}</div>}
                    {doDia.map((a) => (
                      <button key={a.id} onClick={() => setDetalheId(a.id)} className={`w-full text-left rounded px-1.5 py-1 text-[11px] leading-tight ${COR[a.status]}`}>
                        <div className="font-medium">{fmtHora(a.horario_inicio)}{a.horario_fim ? ` – ${fmtHora(a.horario_fim)}` : ""}</div>
                        <div className="truncate">{a.empresa?.nome}</div>
                        {a.responsavel && <div className="truncate text-muted-foreground">{a.responsavel}</div>}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-500" />Agendada</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />A definir</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Concluída</span>
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[["Ações no mês", ags.length], ["Inscritas", stats.insc], ["Coletas realizadas", stats.real], ["Comparecimento", `${stats.taxa}%`]].map(([l, v]) => (
              <Card key={l as string} className="p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="text-2xl font-semibold">{v}</div></Card>
            ))}
          </div>
          <Card className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="font-medium">Por empresa</h2>
              <Button size="sm" variant="outline" onClick={exportarMes}><FileSpreadsheet className="h-4 w-4 mr-1" />Exportar mês</Button>
            </div>
            <div className="divide-y divide-border text-sm">
              <div className="grid grid-cols-5 py-2 text-xs text-muted-foreground"><span className="col-span-2">Empresa</span><span>Inscritas</span><span>Realizadas</span><span>Faltas</span></div>
              {stats.porEmpresa.map((e) => (
                <div key={e.nome} className="grid grid-cols-5 py-2"><span className="col-span-2 truncate">{e.nome}</span><span>{e.insc}</span><span>{e.real}</span><span>{e.falt}</span></div>
              ))}
              {!stats.porEmpresa.length && <div className="py-6 text-center text-muted-foreground">Sem ações neste mês.</div>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <ColetaDetalheSheet ag={detalhe} onClose={() => setDetalheId(null)} onEdit={(a) => { setDetalheId(null); setForm(a); }} />

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{form?.id ? "Editar agendamento" : "Novo agendamento"}</DialogTitle></DialogHeader>
          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Empresa</Label>
                <Select value={form.empresa_id} onValueChange={(v) => setForm({ ...form, empresa_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                  <SelectContent className="max-h-72">{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ColetaStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS_LABEL) as ColetaStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Início</Label><Input type="time" value={fmtHora(form.horario_inicio)} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="time" value={fmtHora(form.horario_fim)} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} /></div>
              <div className="col-span-2"><Label>Responsável</Label><Input value={form.responsavel ?? ""} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
              <div className="col-span-2"><Label>Local</Label><Input value={form.local ?? ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
              <div><Label>Vagas (opcional)</Label><Input type="number" min={1} value={form.vagas ?? ""} onChange={(e) => setForm({ ...form, vagas: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label>Inscrições até</Label><Input type="date" value={form.data_limite ?? ""} onChange={(e) => setForm({ ...form, data_limite: e.target.value })} /></div>
              <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={m.salvarAgendamento.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
