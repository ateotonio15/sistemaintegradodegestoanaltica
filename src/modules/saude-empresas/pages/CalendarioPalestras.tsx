import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths, eachDayOfInterval, endOfMonth, format,
  isSameMonth, isToday, startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, ArrowLeft, Plus, FileSpreadsheet,
  X, Ban, Mic,
} from "lucide-react";
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
  Palestra, PalestraStatus,
  usePalestras, useBloqueios, usePalestrasRealtime,
} from "../hooks/usePalestras";
import { useEmpresasAtivas, useExecutivas } from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { GESTANTES_2026, CAMPANHAS, MESES_PT } from "../lib/palestras-calendario";
import { PalestraDialog } from "../components/PalestraDialog";
import { BloqueioDialog } from "../components/BloqueioDialog";
import type { Bloqueio } from "../hooks/usePalestras";

const STATUS_BADGE: Record<string, string> = {
  a_confirmar: "bg-yellow-100 text-yellow-900 border-yellow-300",
  confirmado: "bg-green-100 text-green-900 border-green-300",
  concluido: "bg-emerald-700 text-white border-emerald-800",
  cancelado: "bg-red-100 text-red-900 border-red-300",
};
const STATUS_LABEL: Record<string, string> = {
  a_confirmar: "A confirmar", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado",
};
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function CalendarioPalestras() {
  usePalestrasRealtime();
  const { user, isAdmin, isExecutivo, isEnfermeira, isDiretora } = useAuth();
  const canEdit = isAdmin || isExecutivo || isEnfermeira || isDiretora;
  const isReadOnly = false;

  const { data: profile } = useQuery({
    queryKey: ["profile_self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("display_name, username").eq("user_id", user!.id).maybeSingle();
      return data as { display_name: string | null; username: string | null } | null;
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
    if (fEmpresa !== "all" && p.empresa_id !== fEmpresa) return false;
    if (fExec !== "all" && p.executiva_user_id !== fExec) return false;
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
    return b ? { periodo: b.periodo, motivo: b.motivo } : null;
  };

  const openNewForDay = (d: Date) => {
    if (!canEdit) return;
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
      .filter((e) => (fEmpresa === "all" || e.empresa_id === fEmpresa))
      .filter((e) => (fExec === "all" || e.executiva_user_id === fExec))
      .filter((e) => (fStatus === "all" || e.status === fStatus))
      .map((e) => ({
        Data: format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy"),
        Empresa: e.empresa?.nome ?? "",
        Endereço: e.endereco ?? "",
        "Horário início": e.horario_inicio?.slice(0, 5) ?? "",
        "Horário fim": e.horario_fim?.slice(0, 5) ?? "",
        Tema: e.tema ?? "",
        Executiva: e.executiva_nome ?? "",
        Status: STATUS_LABEL[e.status] ?? e.status,
        "Motivo cancelamento": e.motivo_cancelamento ?? "",
        Observação: e.observacao ?? "",
        "Criado por": e.created_by_nome ?? "",
        "Última edição": e.updated_by_nome
          ? `${e.updated_by_nome} em ${format(new Date(e.updated_at), "dd/MM/yyyy HH:mm")}`
          : "",
      }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Palestras");
    XLSX.writeFile(wb, `calendario-palestras-${format(cursor, "yyyy-MM")}.xlsx`);
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/saude-empresas" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center">
              <Mic className="h-5 w-5 text-white" />
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
          {/* Filtros */}
          <Card className="p-3">
            <div className="grid md:grid-cols-6 gap-2">
              <Select value={fEmpresa} onValueChange={setFEmpresa}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((e) => (<SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={fExec} onValueChange={setFExec}>
                <SelectTrigger><SelectValue placeholder="Todas as executivas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as executivas</SelectItem>
                  {executivas.map((e) => (<SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>))}
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
              <div className="flex gap-2">
                {canEdit && (
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

          {/* Navegação mês */}
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

          {/* Grade seg-sex */}
          <Card className="overflow-hidden">
            <div className="grid grid-cols-5 bg-muted/40">
              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta"].map((d) => (
                <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-5 auto-rows-fr">
              {diasUteis.map((d) => {
                const key = isoDate(d);
                const evs = porDia.get(key) ?? [];
                const isOut = !isSameMonth(d, cursor);
                const fer = feriadoEm(d);
                const bl = bloqByDate.get(key);
                const fullBlock = !!fer || (bl?.periodo === "dia_todo");

                return (
                  <div
                    key={key}
                    onClick={() => !fullBlock && openNewForDay(d)}
                    className={[
                      "min-h-[110px] border-t border-l p-1.5 text-xs relative",
                      isOut ? "opacity-50" : "",
                      fer ? "bg-amber-50/60" : "",
                      fullBlock ? "cursor-not-allowed" : canEdit ? "cursor-pointer hover:bg-accent/40" : "cursor-default",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold tabular-nums ${isToday(d) ? "text-primary" : ""}`}>
                        {format(d, "d")}
                      </span>
                      {isToday(d) && <Badge variant="outline" className="text-[9px] h-4">Hoje</Badge>}
                    </div>
                    {fer && (
                      <div className="mt-1 inline-block bg-amber-100 text-amber-900 border border-amber-300 rounded px-1.5 py-0.5 text-[10px] font-medium">
                        FERIADO — {fer.nome}
                      </div>
                    )}
                    {bl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); openBloqEdit(bl); }}
                        className="mt-1 w-full inline-flex items-center gap-1 bg-slate-200 text-slate-800 border border-slate-300 rounded px-1.5 py-0.5 text-[10px] font-medium"
                        title={bl.motivo}
                      >
                        <Ban className="h-3 w-3" />
                        {bl.periodo === "dia_todo" ? "Dia bloqueado" : bl.periodo === "manha" ? "Manhã bloqueada" : "Tarde bloqueada"}
                      </button>
                    )}
                    <div className="mt-1 space-y-1">
                      {evs.map((ev) => (
                        <button
                          key={ev.id}
                          onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                          title={`${ev.horario_inicio?.slice(0, 5) ?? "--:--"} - ${ev.horario_fim?.slice(0, 5) ?? "--:--"} ${ev.empresa?.nome ?? ""}`}
                          className={`w-full text-left rounded border px-1.5 py-1 ${STATUS_BADGE[ev.status]}`}
                        >
                          <div className="font-semibold leading-tight tabular-nums">
                            {(ev.horario_inicio?.slice(0, 5) ?? "--:--")} - {(ev.horario_fim?.slice(0, 5) ?? "--:--")}
                          </div>
                          <div className="truncate">{ev.empresa?.nome ?? "—"}</div>
                          {ev.tema && <div className="truncate opacity-80">{ev.tema}</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
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
      />

      <BloqueioDialog
        open={bloqOpen}
        onOpenChange={setBloqOpen}
        editing={editingB}
        preselectDate={preselectBloq}
        canEdit={canEdit}
        userNome={profile?.display_name ?? null}
      />
    </div>
  );
}
