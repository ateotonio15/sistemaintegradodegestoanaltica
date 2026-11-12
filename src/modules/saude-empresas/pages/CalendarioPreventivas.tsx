import { AgendaCalendar } from "@/components/ui/agenda-calendar";
import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  endOfMonth, format, startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, FlaskConical, Stethoscope, ChevronLeft, ChevronRight,
  ArrowLeft, Plus, FileSpreadsheet, Info, X, ChevronsUpDown, FileDown, Image as ImageIcon,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AcaoPreventiva, AcaoPreventivaStatus, AcaoPreventivaTipo,
  useAcoesPreventivas, useAcoesPreventivasRealtime, useEmpresasAtivas, useExecutivas,
} from "../hooks/useAcoesPreventivas";
import { feriadoEm } from "../lib/feriados";
import { EventoPreventivoDialog } from "../components/EventoPreventivoDialog";
import { exportCalendarioPDF, exportCalendarioPNG, type CalEvento } from "../lib/palestras-calendario-export";

const TIPOS: { v: AcaoPreventivaTipo; label: string; sub: string; icon: any; gradient: string }[] = [
  { v: "sinais_vitais", label: "Sinais Vitais", sub: "Aferição de PA, glicemia e bioimpedância nas empresas", icon: Activity, gradient: "from-emerald-500 to-teal-600" },
  { v: "preventivo", label: "Coleta de Preventivo", sub: "Agendamento de coletas preventivas (Papanicolau, etc.)", icon: FlaskConical, gradient: "from-pink-500 to-rose-600" },
  { v: "psa", label: "Coleta de PSA", sub: "Agendamento de coletas para PSA (saúde do homem)", icon: Stethoscope, gradient: "from-blue-600 to-sky-700" },
];

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

export default function CalendarioPreventivas() {
  const [params, setParams] = useSearchParams();
  const tipo = params.get("tipo") as AcaoPreventivaTipo | null;

  if (!tipo || !TIPOS.find((t) => t.v === tipo)) return <SelecionarTipo setParams={setParams} />;
  return <CalendarioTipo tipo={tipo} onBack={() => setParams({})} />;
}

function SelecionarTipo({ setParams }: { setParams: (p: any) => void }) {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <Link to="/" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-2xl font-bold mt-2">Calendário de Ações Preventivas</h1>
        <p className="text-muted-foreground">Selecione o tipo de ação para visualizar o calendário.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {TIPOS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.v} onClick={() => setParams({ tipo: t.v })} className="text-left group">
              <Card className="p-6 hover:shadow-lg transition-all hover:-translate-y-1 h-full">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center mb-4 shadow-md`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-semibold text-lg">{t.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.sub}</p>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalendarioTipo({ tipo, onBack }: { tipo: AcaoPreventivaTipo; onBack: () => void }) {
  useAcoesPreventivasRealtime();
  const { user, isAdmin, isExecutivo, isEnfermeira, isDiretora } = useAuth();
  const canEdit = isAdmin || isExecutivo || isEnfermeira;
  const isReadOnly = isDiretora && !isAdmin;

  const { data: profile } = useQuery({
    queryKey: ["profile_self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("display_name").eq("user_id", user?.id).maybeSingle();
      return data as { display_name: string | null } | null;
    },
  });

  const today = new Date();
  const psaLocked = tipo === "psa";
  const initialCursor = psaLocked ? new Date(today.getFullYear(), 10, 1) : startOfMonth(today);
  const [cursor, setCursor] = useState<Date>(initialCursor);
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Filtros
  const [fEmpresa, setFEmpresa] = useState<string>("all");
  const [fExec, setFExec] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [empresaPopOpen, setEmpresaPopOpen] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AcaoPreventiva | null>(null);
  const [preselect, setPreselect] = useState<Date[]>([]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const { data: eventos = [] } = useAcoesPreventivas(tipo, isoDate(monthStart), isoDate(monthEnd));
  const { data: executivas = [] } = useExecutivas();
  const { data: empresas = [] } = useEmpresasAtivas();

  const filtrados = useMemo(() => {
    return eventos.filter((e) => {
      if (e.status === "cancelado") return false; // some da grade
      if (fEmpresa !== "all" && e.empresa_id !== fEmpresa) return false;
      if (fExec !== "all" && e.executiva_user_id !== fExec) return false;
      if (fStatus !== "all" && e.status !== fStatus) return false;
      return true;
    });
  }, [eventos, fEmpresa, fExec, fStatus]);

  const openNewForDay = (d: Date) => {
    if (!canEdit) return;
    const fer = feriadoEm(d);
    if (fer) { toast.info(`${format(d, "dd/MM")} é feriado (${fer.nome}). Não é possível agendar.`); return; }
    if (psaLocked && d.getMonth() !== 10) {
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

  const limparFiltros = () => { setFEmpresa("all"); setFExec("all"); setFStatus("all"); };

  const exportXlsx = () => {
    // Exporta TODOS os eventos do mês (inclusive cancelados) para auditoria
    const rows = eventos
      .filter((e) => (fEmpresa === "all" || e.empresa_id === fEmpresa))
      .filter((e) => (fExec === "all" || e.executiva_user_id === fExec))
      .filter((e) => (fStatus === "all" || e.status === fStatus))
      .map((e) => ({
        Data: format(new Date(e.data + "T00:00:00"), "dd/MM/yyyy"),
        Empresa: e.empresa?.nome ?? "",
        Endereço: e.endereco ?? "",
        "Horário início": e.horario_inicio?.slice(0, 5) ?? "",
        "Horário fim": e.horario_fim?.slice(0, 5) ?? "",
        Responsável: e.responsavel ?? "",
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

  const tipoMeta = TIPOS.find((t) => t.v === tipo) ?? TIPOS[0];
  const Icon = tipoMeta.icon;

  const exportCal = async (fmt: "pdf" | "png") => {
    const evs: CalEvento[] = filtrados.map((e) => ({
      data: e.data,
      empresa: e.empresa?.nome ?? "",
      executiva: e.executiva_nome ?? null,
      tema: e.responsavel ? `Resp.: ${e.responsavel}` : e.endereco ?? null,
      horario_inicio: e.horario_inicio ?? null,
      horario_fim: e.horario_fim ?? null,
      status: e.status,
    }));
    const opts = {
      titulo: `Calendário de ${tipoMeta.label}`,
      mostrarCampanha: false,
      arquivo: `calendario-${tipo}`,
    };
    try {
      if (fmt === "pdf") await exportCalendarioPDF(cursor, evs, [], opts);
      else await exportCalendarioPNG(cursor, evs, [], opts);
    } catch {
      toast.error("Não foi possível gerar o calendário.");
    }
  };


  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button onClick={onBack} className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-3 mt-2">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${tipoMeta.gradient} flex items-center justify-center`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{tipoMeta.label}</h1>
              <p className="text-sm text-muted-foreground">{tipoMeta.sub}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
          </Button>
          <Button variant="outline" onClick={() => exportCal("pdf")}>
            <FileDown className="h-4 w-4 mr-1" /> Calendário PDF
          </Button>
          <Button variant="outline" onClick={() => exportCal("png")}>
            <ImageIcon className="h-4 w-4 mr-1" /> Calendário PNG
          </Button>
          {canEdit && (
            <Button onClick={openBlank}>
              <Plus className="h-4 w-4 mr-1" /> Novo evento
            </Button>
          )}
        </div>
      </div>

      {/* Banner PSA */}
      {psaLocked && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-900 px-4 py-3 text-sm">
          <Info className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <strong>Novembro Azul.</strong> A Coleta de PSA fica disponível apenas em novembro; a navegação de mês está desabilitada.
          </div>
        </div>
      )}

      {/* Filtros */}
      <Card className="p-3">
        <div className="grid md:grid-cols-4 gap-2">
          <Popover open={empresaPopOpen} onOpenChange={setEmpresaPopOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="justify-between font-normal">
                <span className="truncate">
                  {fEmpresa === "all"
                    ? "Todas as empresas"
                    : empresas.find((e) => e.id === fEmpresa)?.nome ?? "Todas as empresas"}
                </span>
                <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command>
                <CommandInput placeholder="Buscar empresa..." />
                <CommandList>
                  <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="Todas as empresas" onSelect={() => { setFEmpresa("all"); setEmpresaPopOpen(false); }}>
                      Todas as empresas
                    </CommandItem>
                    {empresas.map((e) => (
                      <CommandItem key={e.id} value={e.nome} onSelect={() => { setFEmpresa(e.id); setEmpresaPopOpen(false); }}>
                        {e.nome}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select value={fExec} onValueChange={setFExec}>
            <SelectTrigger><SelectValue placeholder="Todas as executivas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as executivas</SelectItem>
              {executivas.map((e) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(["a_confirmar", "confirmado", "concluido", "cancelado"] as AcaoPreventivaStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        </div>
      </Card>

      <AgendaCalendar
        month={cursor} onMonthChange={setCursor} selected={selectedDay} onSelect={setSelectedDay}
        locked={psaLocked} holiday={(date) => feriadoEm(date)?.nome}
        items={filtrados.map((ev) => ({ id: ev.id, date: ev.data, title: ev.empresa?.nome ?? "—",
          time: `${ev.horario_inicio?.slice(0, 5) ?? "--:--"} – ${ev.horario_fim?.slice(0, 5) ?? "--:--"}`,
          status: STATUS_LABEL[ev.status], onOpen: () => openEdit(ev),
          details: <><p>Executiva: {ev.executiva_nome ?? "—"}</p>{ev.responsavel && <p>Responsável: {ev.responsavel}</p>}{ev.endereco && <p>{ev.endereco}</p>}{ev.observacao && <p>{ev.observacao}</p>}</>,
        }))}
        dayActions={(date) => canEdit && !isReadOnly && !feriadoEm(date) && (!psaLocked || date.getMonth() === 10) ? <Button size="sm" variant="outline" onClick={() => openNewForDay(date)}><Plus className="mr-1 h-4 w-4" />Novo</Button> : null}
      />

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground items-center pt-2">
        <span className="font-semibold uppercase tracking-wider text-[10px]">Legenda:</span>
        {(["a_confirmar", "confirmado", "concluido", "cancelado"] as AcaoPreventivaStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_LEGEND[s]}`} />
            <span className="text-[10px] uppercase tracking-wider font-medium">{STATUS_LABEL[s]}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <span className="text-[10px] uppercase tracking-wider font-medium">Feriado</span>
        </span>
      </div>


      <EventoPreventivoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tipo={tipo}
        editing={editing}
        preselect={preselect}
        canEdit={canEdit}
        isReadOnly={isReadOnly}
        userNome={profile?.display_name ?? null}
        userUsername={null}
      />
    </div>
  );
}
