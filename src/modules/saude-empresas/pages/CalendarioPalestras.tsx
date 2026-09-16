import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths, eachDayOfInterval, endOfMonth, format,
  isSameMonth, isToday, startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Plus, FileSpreadsheet,
  X, Ban, CalendarDays, BarChart3, FileDown, Image as ImageIcon,
} from "lucide-react";
import { exportCalendarioPDF, exportCalendarioPNG } from "../lib/palestras-calendario-export";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Palestra, PalestraStatus, Bloqueio,
  usePalestras, useBloqueios, usePalestrasRealtime,
} from "../hooks/usePalestras";
import { useEmpresasAtivas, useExecutivas } from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { GESTANTES_2026, CAMPANHAS, MESES_PT } from "../lib/palestras-calendario";
import { PalestraDialog } from "../components/PalestraDialog";
import { BloqueioDialog } from "../components/BloqueioDialog";
import { RelatorioMensalDialog } from "../components/RelatorioMensalDialog";

// Card style: fundo tintado + borda lateral colorida (status)
const STATUS_CARD: Record<string, string> = {
  a_confirmar: "bg-amber-500/10 border-l-4 border-amber-500 hover:bg-amber-500/20",
  confirmado: "bg-sky-500/10 border-l-4 border-sky-500 hover:bg-sky-500/20",
  concluido: "bg-emerald-500/10 border-l-4 border-emerald-500 hover:bg-emerald-500/20",
  cancelado: "bg-rose-500/10 border-l-4 border-rose-500 hover:bg-rose-500/20",
};
const STATUS_TIME: Record<string, string> = {
  a_confirmar: "text-amber-400",
  confirmado: "text-sky-400",
  concluido: "text-emerald-400",
  cancelado: "text-rose-400",
};
const STATUS_LEGEND: Record<string, string> = {
  a_confirmar: "bg-amber-500",
  confirmado: "bg-sky-500",
  concluido: "bg-emerald-500",
  cancelado: "bg-rose-500",
};
const STATUS_LABEL: Record<string, string> = {
  a_confirmar: "A confirmar", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarioPalestras() {
  usePalestrasRealtime();
  const { user, isAdmin, isExecutivo, isExecutivoExterno, isEnfermeira, isDiretora } = useAuth();
  // CRUD: admin, executivo, enfermeira. Diretora e executivo externo: só leitura.
  const canEdit = isAdmin || isExecutivo || isEnfermeira;
  const isReadOnly = isDiretora || isExecutivoExterno;

  const { data: profile } = useQuery({
    queryKey: ["profile_self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("display_name").eq("user_id", user!.id).maybeSingle();
      return data as { display_name: string | null } | null;
    },
  });

  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [fEmpresa, setFEmpresa] = useState("all");
  const [fExec, setFExec] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const [palestraOpen, setPalestraOpen] = useState(false);
  const [editingP, setEditingP] = useState<Palestra | null>(null);
  const [preselectDatas, setPreselectDatas] = useState<Date[]>([]);

  const [bloqOpen, setBloqOpen] = useState(false);
  const [editingB, setEditingB] = useState<Bloqueio | null>(null);
  const [preselectBloq, setPreselectBloq] = useState<Date | null>(null);
  const [relatorioOpen, setRelatorioOpen] = useState(false);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const { data: palestras = [] } = usePalestras(isoDate(monthStart), isoDate(monthEnd));
  const { data: bloqueios = [] } = useBloqueios(isoDate(monthStart), isoDate(monthEnd));
  const { data: empresas = [] } = useEmpresasAtivas();
  const { data: executivas = [] } = useExecutivas();

  const bloqByDate = useMemo(() => {
    const m = new Map<string, Bloqueio>();
    bloqueios.forEach((b) => m.set(b.data, b));
    return m;
  }, [bloqueios]);

  const filtradas = useMemo(() => palestras.filter((p) => {
    if (p.status === "cancelado") return false;
    if (fEmpresa !== "all" && p.empresa !== fEmpresa) return false;
    if (fExec !== "all" && p.executiva !== fExec) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    return true;
  }), [palestras, fEmpresa, fExec, fStatus]);

  const porDia = useMemo(() => {
    const m = new Map<string, Palestra[]>();
    filtradas.forEach((e) => {
      const arr = m.get(e.data) ?? [];
      arr.push(e); m.set(e.data, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => (a.horario_inicio ?? "").localeCompare(b.horario_inicio ?? "")));
    return m;
  }, [filtradas]);

  const diasUteis = useMemo(() =>
    eachDayOfInterval({ start: monthStart, end: monthEnd })
      .filter((d) => d.getDay() >= 1 && d.getDay() <= 5),
    [monthStart, monthEnd]
  );

  const bloqueioLookup = (d: Date) => {
    const b = bloqByDate.get(isoDate(d));
    return b ? { periodo: b.periodo, motivo: b.motivo, hora_inicio: b.hora_inicio, hora_fim: b.hora_fim } : null;
  };

  const openNewForDay = (d: Date) => {
    if (!canEdit || isReadOnly) return;
    const fer = feriadoEm(d);
    if (fer) return;
    const b = bloqByDate.get(isoDate(d));
    if (b && b.periodo === "dia_todo") return;
    setEditingP(null);
    setPreselectDatas([d]);
    setPalestraOpen(true);
  };

  const openEdit = (ev: Palestra) => {
    setEditingP(ev); setPreselectDatas([]); setPalestraOpen(true);
  };

  const openBlank = () => {
    setEditingP(null); setPreselectDatas([]); setPalestraOpen(true);
  };

  const openBloqNew = () => {
    setEditingB(null); setPreselectBloq(null); setBloqOpen(true);
  };
  const openBloqEdit = (b: Bloqueio) => {
    setEditingB(b); setPreselectBloq(null); setBloqOpen(true);
  };

  const limparFiltros = () => { setFEmpresa("all"); setFExec("all"); setFStatus("all"); };

  const exportXlsx = () => {
    const rows = palestras
      .filter((e) => (fEmpresa === "all" || e.empresa === fEmpresa))
      .filter((e) => (fExec === "all" || e.executiva === fExec))
      .filter((e) => (fStatus === "all" || e.status === fStatus))
      .map((e) => ({
        Data: format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy"),
        Empresa: e.empresa,
        Endereço: e.endereco ?? "",
        "Horário início": e.horario_inicio?.slice(0, 5) ?? "",
        "Horário fim": e.horario_fim?.slice(0, 5) ?? "",
        Tema: e.tema ?? "",
        Executiva: e.executiva,
        Status: STATUS_LABEL[e.status] ?? e.status,
        "Motivo cancelamento": e.motivo_cancelamento ?? "",
        Observação: e.observacao ?? "",
        "Criado por": e.criado_por ?? "",
        "Última edição": e.editado_por
          ? `${e.editado_por} em ${format(new Date(e.updated_at), "dd/MM/yyyy HH:mm")}`
          : "",
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Palestras");
    XLSX.writeFile(wb, `calendario-palestras-${format(cursor, "yyyy-MM")}.xlsx`);
  };

  const podeEditar = canEdit && !isReadOnly;

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Calendário de Palestras</h1>
              <p className="text-sm text-muted-foreground">Agenda anual de palestras de saúde nas empresas parceiras.</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="calendario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendario">Calendário</TabsTrigger>
          <TabsTrigger value="programacao">Programação Anual</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="space-y-4">
          <Card className="p-3">
            <div className="grid md:grid-cols-6 gap-2">
              <Select value={fEmpresa} onValueChange={setFEmpresa}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((e) => (<SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={fExec} onValueChange={setFExec}>
                <SelectTrigger><SelectValue placeholder="Todas as executivas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as executivas</SelectItem>
                  {executivas.map((e) => (<SelectItem key={e.user_id} value={e.display_name}>{e.display_name}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {(["a_confirmar", "confirmado", "concluido", "cancelado"] as PalestraStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={limparFiltros}>
                <X className="h-4 w-4 mr-1" /> Limpar
              </Button>
              <Button variant="outline" onClick={exportXlsx}>
                <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
              </Button>
              <Button variant="outline" onClick={() => exportCalendarioPDF(cursor, filtradas as any, bloqueios as any)}>
                <FileDown className="h-4 w-4 mr-1" /> Calendário PDF
              </Button>
              <Button variant="outline" onClick={() => exportCalendarioPNG(cursor, filtradas as any, bloqueios as any)}>
                <ImageIcon className="h-4 w-4 mr-1" /> Calendário PNG
              </Button>
              <Button variant="outline" onClick={() => setRelatorioOpen(true)}>
                <BarChart3 className="h-4 w-4 mr-1" /> Gerar Relatório Mensal
              </Button>

              <div className="flex gap-2">
                {podeEditar && (
                  <>
                    <Button variant="outline" onClick={openBloqNew} className="flex-1">
                      <Ban className="h-4 w-4 mr-1" /> Bloqueio
                    </Button>
                    <Button onClick={openBlank} className="flex-1">
                      <Plus className="h-4 w-4 mr-1" /> Palestra
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCursor(startOfMonth(new Date()))}>Hoje</Button>
              <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-lg font-semibold capitalize">
              {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
            </div>
            <div className="text-xs text-muted-foreground">
              Campanha do mês: <span className="font-medium" style={{ color: CAMPANHAS[cursor.getMonth()].hex }}>
                {CAMPANHAS[cursor.getMonth()].tema}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="grid grid-cols-5 border-b border-border/60 bg-muted/30">
              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((d) => (
                <div key={d} className="py-3 text-center text-[10px] uppercase font-bold text-muted-foreground tracking-widest border-r last:border-r-0 border-border/60">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-5 auto-rows-fr">
              {diasUteis.length > 0 && Array.from({ length: Math.max(0, (diasUteis[0].getDay() || 7) - 1) }).map((_, i) => (
                <div key={`pad-start-${i}`} className="min-h-[160px] border-r border-b border-border/60 bg-muted/10" />
              ))}
              {diasUteis.map((d) => {
                const key = isoDate(d);
                const evs = porDia.get(key) ?? [];
                const isOut = !isSameMonth(d, cursor);
                const fer = feriadoEm(d);
                const bl = bloqByDate.get(key);
                const fullBlock = !!fer || (bl?.periodo === "dia_todo");
                const today = isToday(d);

                return (
                  <div
                    key={key}
                    onClick={() => !fullBlock && openNewForDay(d)}
                    className={[
                      "min-h-[160px] p-2 relative border-r border-b border-border/60 transition-colors",
                      isOut ? "opacity-40" : "",
                      fer ? "bg-amber-500/5" : today ? "bg-primary/5" : "bg-transparent",
                      fullBlock ? "cursor-not-allowed" : podeEditar ? "cursor-pointer hover:bg-accent/30" : "cursor-default",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold tabular-nums ${today ? "text-primary" : "text-foreground"}`}>
                        {format(d, "d")}
                      </span>
                      {today && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-primary uppercase tracking-tighter">
                          <span className="w-1 h-1 rounded-full bg-primary" /> Hoje
                        </span>
                      )}
                    </div>
                    {fer && (
                      <div className="mb-1 inline-block bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                        FERIADO · {fer.nome}
                      </div>
                    )}
                    {bl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (podeEditar) openBloqEdit(bl); }}
                        className="mb-1 w-full text-left bg-red-500/20 text-red-400 border border-red-500/50 rounded px-1.5 py-0.5 hover:bg-red-500/30"
                        title={bl.motivo}
                      >
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                          <Ban className="h-3 w-3 shrink-0" />
                          {bl.periodo === "dia_todo"
                            ? "Dia bloqueado"
                            : bl.periodo === "manha"
                              ? "Manhã bloqueada"
                              : bl.periodo === "tarde"
                                ? "Tarde bloqueada"
                                : `${(bl.hora_inicio ?? "").slice(0, 5)}–${(bl.hora_fim ?? "").slice(0, 5)} bloqueado`}
                        </span>
                        {bl.motivo && (
                          <span className="block text-[9px] font-medium normal-case leading-tight text-red-300/90 break-words">
                            {bl.motivo}
                          </span>
                        )}
                      </button>
                    )}

                    <div className="space-y-1.5">
                      {evs.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          title={`${ev.horario_inicio?.slice(0, 5) ?? "--:--"} - ${ev.horario_fim?.slice(0, 5) ?? "--:--"} · ${ev.empresa}`}
                          className={`w-full text-left rounded-r px-2 py-1.5 transition-colors ${STATUS_CARD[ev.status]}`}
                        >
                          <div className={`text-[10px] font-mono font-bold tabular-nums ${STATUS_TIME[ev.status]}`}>
                            {(ev.horario_inicio?.slice(0, 5) ?? "--:--")} – {(ev.horario_fim?.slice(0, 5) ?? "--:--")}
                          </div>
                          <div className="text-[11px] font-semibold text-foreground uppercase truncate leading-tight mt-0.5">
                            {ev.empresa}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{ev.executiva}</div>
                          {ev.tema && <div className="text-[10px] text-muted-foreground/80 italic truncate">{ev.tema}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground items-center pt-2">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Legenda:</span>
            {(["a_confirmar", "confirmado", "concluido", "cancelado"] as PalestraStatus[]).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_LEGEND[s]}`} />
                <span className="text-[10px] uppercase tracking-wider font-medium">{STATUS_LABEL[s]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Feriado</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Ban className="h-3 w-3 text-red-400" />
              <span className="text-[10px] uppercase tracking-wider font-medium">Bloqueio</span>
            </span>
          </div>
        </TabsContent>

        <TabsContent value="programacao" className="space-y-6">
          <Card className="p-4">
            <h2 className="font-semibold text-base mb-3">Palestras para Gestantes — 2026</h2>
            <div className="grid md:grid-cols-3 gap-2">
              {MESES_PT.map((m, idx) => (
                <div key={m} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{m}</div>
                  <div className="text-sm font-medium mt-1">{GESTANTES_2026[idx]}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="font-semibold text-base mb-3">Campanhas Mensais — Calendário Colorido</h2>
            <div className="grid md:grid-cols-3 gap-2">
              {MESES_PT.map((m, idx) => {
                const c = CAMPANHAS[idx];
                return (
                  <div key={m} className="border rounded-lg p-3 flex items-start gap-3">
                    <div className="w-3 h-full min-h-[36px] rounded-sm shrink-0" style={{ background: c.hex }} />
                    <div>
                      <div className="text-xs text-muted-foreground">{m} · {c.cor}</div>
                      <div className="text-sm font-medium mt-1">{c.tema}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <PalestraDialog
        open={palestraOpen}
        onOpenChange={setPalestraOpen}
        editing={editingP}
        preselect={preselectDatas}
        canEdit={canEdit}
        isReadOnly={isReadOnly}
        userNome={profile?.display_name ?? null}
        bloqueiosFn={bloqueioLookup}
        onBloquearAgenda={(d) => {
          setPalestraOpen(false);
          setEditingB(null);
          setPreselectBloq(d);
          setBloqOpen(true);
        }}
      />

      <BloqueioDialog
        open={bloqOpen}
        onOpenChange={setBloqOpen}
        editing={editingB}
        preselectDate={preselectBloq}
        canEdit={canEdit && !isReadOnly}
        userNome={profile?.display_name ?? null}
      />

      <RelatorioMensalDialog
        open={relatorioOpen}
        onOpenChange={setRelatorioOpen}
        defaultDate={cursor}
      />
    </div>
  );
}
