import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, FlaskConical, Stethoscope, ChevronLeft, ChevronRight,
  ArrowLeft, Plus, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AcaoPreventiva, AcaoPreventivaTipo,
  useAcoesPreventivas, useAcoesPreventivasRealtime, useExecutivas,
} from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { EventoPreventivoDialog } from "../components/EventoPreventivoDialog";

const TIPOS: { v: AcaoPreventivaTipo; label: string; icon: any; gradient: string }[] = [
  { v: "sinais_vitais", label: "Sinais Vitais", icon: Activity, gradient: "from-emerald-500 to-teal-600" },
  { v: "preventivo", label: "Coleta de Preventivo", icon: FlaskConical, gradient: "from-pink-500 to-rose-600" },
  { v: "psa", label: "Coleta de PSA", icon: Stethoscope, gradient: "from-blue-600 to-sky-700" },
];

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

export default function CalendarioPreventivas() {
  const [params, setParams] = useSearchParams();
  const tipo = params.get("tipo") as AcaoPreventivaTipo | null;

  if (!tipo || !TIPOS.find((t) => t.v === tipo)) return <SelecionarTipo setParams={setParams} />;
  return <CalendarioTipo tipo={tipo} />;
}

function SelecionarTipo({ setParams }: { setParams: (p: any) => void }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <Link to="/saude-empresas" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Calendário de Ações Preventivas</h1>
        <p className="text-muted-foreground">Selecione o tipo de ação para visualizar o calendário.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {TIPOS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.v}
              onClick={() => setParams({ tipo: t.v })}
              className="text-left group"
            >
              <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center mb-4 shadow-md`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-semibold text-lg">{t.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t.v === "psa" ? "Disponível somente em Novembro." : "Agende para os dias úteis do mês."}
                </p>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioTipo({ tipo }: { tipo: AcaoPreventivaTipo }) {
  useAcoesPreventivasRealtime();
  const { user, isAdmin, isExecutivo, isEnfermeira, isDiretora } = useAuth();
  const canEdit = isAdmin || isExecutivo || isEnfermeira;
  const isReadOnly = isDiretora && !isAdmin;

  // Username + display_name do usuário atual
  const { data: profile } = useQuery({
    queryKey: ["profile_self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("display_name, username").eq("user_id", user!.id).maybeSingle();
      return data as { display_name: string | null; username: string | null } | null;
    },
  });

  const today = new Date();
  const initialCursor = tipo === "psa" ? new Date(today.getFullYear(), 10, 1) : startOfMonth(today);
  const [cursor, setCursor] = useState<Date>(initialCursor);
  const [fExec, setFExec] = useState<string>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcaoPreventiva | null>(null);
  const [preselect, setPreselect] = useState<Date[]>([]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { data: eventos = [] } = useAcoesPreventivas(tipo, isoDate(gridStart), isoDate(gridEnd));
  const { data: executivas = [] } = useExecutivas();

  const filtrados = useMemo(
    () => (fExec === "all" ? eventos : eventos.filter((e) => e.executiva_user_id === fExec)),
    [eventos, fExec]
  );

  const porDia = useMemo(() => {
    const m = new Map<string, AcaoPreventiva[]>();
    filtrados.forEach((e) => {
      const k = e.data;
      const arr = m.get(k) ?? [];
      arr.push(e);
      m.set(k, arr);
    });
    m.forEach((arr) =>
      arr.sort((a, b) => (a.horario_inicio ?? "").localeCompare(b.horario_inicio ?? ""))
    );
    return m;
  }, [filtrados]);

  const psaLocked = tipo === "psa";

  const openNewForDay = (d: Date) => {
    if (!canEdit) return;
    const dow = d.getDay();
    if (dow === 0 || dow === 6) return;
    const fer = feriadoEm(d);
    if (fer) { toast.info(`Dia ${format(d, "dd/MM")} é feriado (${fer.nome}). Não é possível agendar.`); return; }
    if (tipo === "psa" && d.getMonth() !== 10) {
      toast.warning("A Coleta de PSA só pode ser agendada em novembro."); return;
    }
    setEditing(null);
    setPreselect([d]);
    setDialogOpen(true);
  };

  const openEdit = (ev: AcaoPreventiva) => {
    setEditing(ev);
    setPreselect([]);
    setDialogOpen(true);
  };

  const openBlank = () => {
    setEditing(null);
    setPreselect([]);
    setDialogOpen(true);
  };

  const exportXlsx = () => {
    const rows = filtrados.map((e) => ({
      Data: format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy"),
      Tipo: TIPOS.find((t) => t.v === e.tipo)?.label ?? e.tipo,
      Empresa: e.empresa?.nome ?? "",
      Endereço: e.endereco ?? "",
      "Horário início": e.horario_inicio?.slice(0, 5) ?? "",
      "Horário fim": e.horario_fim?.slice(0, 5) ?? "",
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
    XLSX.utils.book_append_sheet(wb, ws, "Calendário");
    XLSX.writeFile(wb, `calendario-${tipo}-${format(cursor, "yyyy-MM")}.xlsx`);
  };

  const tipoMeta = TIPOS.find((t) => t.v === tipo)!;
  const Icon = tipoMeta.icon;

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link to="/saude-empresas/preventivas" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Trocar tipo
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tipoMeta.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{tipoMeta.label}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={fExec} onValueChange={setFExec}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Executiva(o)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as executivas</SelectItem>
              {executivas.map((e) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" disabled={psaLocked} onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" disabled={psaLocked} onClick={() => setCursor(initialCursor)}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" disabled={psaLocked} onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          {canEdit && (
            <Button onClick={openBlank}>
              <Plus className="h-4 w-4 mr-1" /> Novo evento
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/40 text-xs font-medium">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="px-2 py-2 text-center">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((d) => {
            const key = isoDate(d);
            const evs = porDia.get(key) ?? [];
            const isOut = !isSameMonth(d, cursor);
            const fer = feriadoEm(d);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const expanded = expandedKey === key;
            const visible = expanded ? evs : evs.slice(0, 3);
            const hidden = evs.length - visible.length;

            return (
              <div
                key={key}
                onClick={() => !isWeekend && openNewForDay(d)}
                className={[
                  "min-h-[110px] border-t border-l p-1.5 text-xs relative",
                  isOut ? "opacity-50" : "",
                  fer ? "bg-amber-50/60" : "",
                  isWeekend ? "bg-muted/30 cursor-default" : canEdit ? "cursor-pointer hover:bg-accent/40" : "cursor-default",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${isToday(d) ? "text-primary" : ""}`}>
                    {format(d, "d")}
                  </span>
                </div>
                {fer && (
                  <div className="mt-1 inline-block bg-amber-100 text-amber-900 border border-amber-300 rounded px-1.5 py-0.5 text-[10px] font-medium">
                    🟠 FERIADO — {fer.nome}
                  </div>
                )}
                <div className="mt-1 space-y-1">
                  {visible.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                      title={`${ev.horario_inicio?.slice(0, 5) ?? "--:--"} - ${ev.horario_fim?.slice(0, 5) ?? "--:--"} ${ev.empresa?.nome ?? ""} — ${ev.executiva_nome ?? "—"}`}
                      className={`w-full text-left rounded border px-1.5 py-1 ${STATUS_BADGE[ev.status]}`}
                    >
                      <div className="font-semibold leading-tight">
                        {(ev.horario_inicio?.slice(0, 5) ?? "--:--")} - {(ev.horario_fim?.slice(0, 5) ?? "--:--")}
                      </div>
                      <div className="truncate">{ev.empresa?.nome ?? "—"}</div>
                      <div className="truncate opacity-80">{ev.executiva_nome ?? "—"}</div>
                    </button>
                  ))}
                  {hidden > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedKey(key); }}
                      className="text-[10px] text-primary hover:underline"
                    >
                      +{hidden} mais
                    </button>
                  )}
                  {expanded && evs.length > 3 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedKey(null); }}
                      className="text-[10px] text-muted-foreground hover:underline"
                    >
                      Mostrar menos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <EventoPreventivoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo={tipo}
        editing={editing}
        preselect={preselect}
        canEdit={canEdit}
        isReadOnly={isReadOnly}
        userNome={profile?.display_name ?? null}
        userUsername={profile?.username ?? null}
      />
    </div>
  );
}
