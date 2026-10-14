import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User, Building2, MapPin, ChevronDown, Plus, Pencil, Trash2, FileSpreadsheet,
} from "lucide-react";
import ExcelJS from "exceljs";
import { useAtendimentos, usePlantaoMutations, usePlantoes, type Plantao, type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { AtendimentoDialog, parseAssunto } from "@/components/plantoes/AtendimentoDialog";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { AdicionarExecutivaDialog } from "@/components/plantoes/AdicionarExecutivaDialog";
import { InlineDemandaForm } from "@/components/plantoes/InlineDemandaForm";
import { ReincidenciaPanel } from "@/components/plantoes/ReincidenciaPanel";
import { toast } from "sonner";

async function exportarAtendimentosXlsx(
  atendimentos: PlantaoAtendimento[],
  empresaNome: string,
  dataPlantao: string,
) {
  if (!atendimentos.length) {
    toast.info("Nenhum atendimento para exportar");
    return;
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIGA";
  wb.created = new Date();
  const ws = wb.addWorksheet("Atendimentos");
  ws.columns = [
    { header: "Hora", key: "hora", width: 10 },
    { header: "Nome do Cliente", key: "nome_cliente", width: 40 },
    { header: "CPF", key: "cpf", width: 18 },
    { header: "Tipo", key: "tipo", width: 14 },
    { header: "Canal", key: "canal", width: 14 },
    { header: "Status", key: "status", width: 16 },
    { header: "Observação", key: "observacao", width: 50 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16A34A" } };
  });
  atendimentos.forEach((a) => {
    const meta = parseAssunto(a.assunto, a.resolvido);
    ws.addRow({
      hora: a.hora ?? "",
      nome_cliente: a.nome_cliente ?? "",
      cpf: a.cpf ?? "",
      tipo: meta.tipo ?? "",
      canal: meta.canal ?? "",
      status: meta.status ?? (a.resolvido ? "Resolvido" : "Pendente"),
      observacao: a.observacao ?? "",
    });
  });
  ws.columns.forEach((col) => {
    let max = col.header ? String(col.header).length : 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 2, 10), 60);
  });
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const nomeSafe = (empresaNome || "plantao").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const [y, m, d] = dataPlantao.split("-");
  a.href = url;
  a.download = `atendimentos_${nomeSafe}_${d}-${m}-${y}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Excel exportado");
}

const STATUS_COLORS: Record<string, string> = {
  "Pendente": "bg-amber-100 text-amber-700 hover:bg-amber-100 border-0",
  "Em andamento": "bg-blue-100 text-blue-700 hover:bg-blue-100 border-0",
  "Resolvido": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0",
  "Cancelado": "bg-rose-100 text-rose-700 hover:bg-rose-100 border-0",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plantao: Plantao;
  empresaNome?: string;
  isAdmin?: boolean;
}

function canalDe(a: PlantaoAtendimento): "Presencial" | "WhatsApp" {
  const txt = `${a.assunto ?? ""} ${a.observacao ?? ""}`.toLowerCase();
  return /whats|zap|wpp/.test(txt) ? "WhatsApp" : "Presencial";
}

export function PlantaoDetalheDialog({ open, onOpenChange, plantao, empresaNome, isAdmin }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const TIPOS_DEMANDA = ["Consulta", "Exames", "Reclamação", "Outros"] as const;
  const { data: plantoesDia = [] } = usePlantoes({
    empresaId: plantao.empresa_id,
    from: plantao.data,
    to: plantao.data,
  });
  const todosPlantoes = plantoesDia.length > 0 ? plantoesDia : [plantao];
  const [activeId, setActiveId] = useState<string>(plantao.id);
  const [novoPlantao, setNovoPlantao] = useState(false);
  const active = todosPlantoes.find((p) => p.id === activeId) ?? plantao;

  const { data: atendimentos = [] } = useAtendimentos(active.id);
  const { deleteAtendimento, deletePlantao, upsertAtendimento } = usePlantaoMutations();
  const [editAt, setEditAt] = useState<PlantaoAtendimento | null>(null);
  const [novoAt, setNovoAt] = useState(false);
  const [editPlantao, setEditPlantao] = useState(false);
  const [demandasOpen, setDemandasOpen] = useState(true);
  const [cpfReincidencia, setCpfReincidencia] = useState("");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const cpfsDia = useMemo(() => {
    const s = new Set<string>();
    atendimentos.forEach((a) => {
      const d = String(a.cpf ?? "").replace(/\D/g, "");
      if (d.length === 11) {
        s.add(d);
        s.add(`${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`);
      }
    });
    return Array.from(s).sort();
  }, [atendimentos]);

  const { data: contagemCpf = {} } = useQuery({
    queryKey: ["plantoes-reincidencia-contagem", cpfsDia],
    enabled: cpfsDia.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const mapa: Record<string, number> = {};
      const tamanho = 1000;
      for (let inicio = 0; ; inicio += tamanho) {
        const { data, error } = await supabase
          .from("plantoes_atendimentos")
          .select("id, cpf")
          .in("cpf", cpfsDia)
          .order("id")
          .range(inicio, inicio + tamanho - 1);
        if (error) throw error;
        (data ?? []).forEach((r: any) => {
          const d = String(r.cpf ?? "").replace(/\D/g, "");
          mapa[d] = (mapa[d] ?? 0) + 1;
        });
        if ((data?.length ?? 0) < tamanho) break;
      }
      return mapa;
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const isToday = active.data === today;
  const dataFmt = new Date(active.data + "T00:00:00").toLocaleDateString("pt-BR");

  const stats = useMemo(() => {
    const total = atendimentos.length;
    const consultas = atendimentos.filter((a) => /consult/i.test(a.assunto ?? "")).length || total;
    const pendencias = atendimentos.filter((a) => !a.resolvido).length;
    const exames = atendimentos.filter((a) => /exame/i.test(a.assunto ?? "")).length;
    return { total, consultas, pendencias, exames };
  }, [atendimentos]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-[1120px] h-[90dvh] max-h-[90dvh] overflow-hidden p-0 gap-0 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,0.6fr)] md:grid-cols-[minmax(0,768fr)_minmax(0,320fr)] md:grid-rows-[minmax(0,1fr)]">
          <div className="p-6 space-y-5 min-h-0 min-w-0 overflow-y-auto" data-plantao-principal>
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {isToday ? (
                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">EM ANDAMENTO</Badge>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">FINALIZADO</Badge>
                )}
                <Badge variant="outline" className="gap-1">
                  <MapPin className="h-3 w-3" /> PRESENCIAL
                </Badge>
              </div>
              <h2 className="text-3xl font-bold">{dataFmt}</h2>
              <div>
                <span className="text-3xl font-bold text-primary">{stats.total}</span>
                <span className="text-sm text-muted-foreground ml-2">atendimentos no dia</span>
              </div>
            </div>

            {/* Plantonistas tabs */}
            <div className="border-b flex items-center gap-1 flex-wrap">
              {todosPlantoes.map((p) => {
                const isActive = p.id === active.id;
                const count = p.id === active.id ? stats.total : (p.atendimentos_count ?? 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-2 border-b-2 -mb-px transition-colors ${
                      isActive ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isActive ? "bg-primary" : "bg-muted-foreground/40"}`} />
                    {p.plantonista || "Sem plantonista"} <span className="text-muted-foreground">({count})</span>
                  </button>
                );
              })}
              {isAdmin && (
                <button
                  onClick={() => setNovoPlantao(true)}
                  className="px-3 py-2 text-sm text-primary inline-flex items-center gap-1 hover:bg-muted/50 rounded-t-md"
                  title="Adicionar executivo neste dia"
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Plantonista card */}
            <Card className="p-4 space-y-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4" /> {active.plantonista || "—"}
                </div>
                {empresaNome && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" /> {empresaNome}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <KPI value={stats.total} label="Atendimentos" />
                <KPI value={stats.consultas} label="Consultas" />
                <KPI value={stats.pendencias} label="Pendências" />
                <KPI value={stats.exames} label="Exames Autoriz." />
              </div>

              {/* Demandas */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setDemandasOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${demandasOpen ? "" : "-rotate-90"}`} />
                    Demandas ({stats.total})
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportarAtendimentosXlsx(atendimentos, empresaNome ?? active.plantonista ?? "plantao", active.data)}
                    disabled={!atendimentos.length}
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar Excel
                  </Button>
                </div>


                {demandasOpen && (
                  <div className="space-y-2">
                    <InlineDemandaForm
                      key={active.id}
                      plantaoIds={[active.id]}
                      defaultPlantaoId={active.id}
                      empresaNome={empresaNome}
                      empresaId={active.empresa_id}
                      executivaNome={active.plantonista ?? undefined}
                      dataPlantao={active.data}
                      onCpfChange={(v) => {
                        if (!String(v ?? "").replace(/\D/g, "")) return;
                        setSelecionadoId(null);
                        setCpfReincidencia(v);
                      }}
                    />
                    <div className="divide-y border rounded-md">
                      {atendimentos.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground text-center">Nenhuma demanda registrada.</div>
                      )}
                      {atendimentos.map((a) => {
                        const meta = parseAssunto(a.assunto, a.resolvido);
                        const statusOptions = ["Pendente", "Em andamento", "Resolvido", "Cancelado"];
                        const changeStatus = (novo: string) => {
                          upsertAtendimento.mutate({
                            id: a.id,
                            plantao_id: active.id,
                            nome_cliente: a.nome_cliente,
                            cpf: a.cpf,
                            hora: a.hora,
                            observacao: a.observacao,
                            assunto: `${meta.tipo} · ${meta.canal} · ${novo}`,
                            resolvido: novo === "Resolvido",
                          });
                        };
                        return (
                        <div
                          key={a.id}
                          role="button"
                          tabIndex={0}
                          title="Ver reincidência deste beneficiário"
                          onClick={() => {
                            setSelecionadoId(a.id);
                            setCpfReincidencia(a.cpf ?? "");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelecionadoId(a.id);
                              setCpfReincidencia(a.cpf ?? "");
                            }
                          }}
                          className={`p-3 flex items-center gap-3 cursor-pointer transition-colors border-l-2 ${
                            selecionadoId === a.id ? "bg-primary/10 border-l-primary" : "border-l-transparent hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm flex items-center flex-wrap gap-x-2">
                              <span className="font-medium">{a.nome_cliente}</span>
                              {(() => {
                                const d = String(a.cpf ?? "").replace(/\D/g, "");
                                const outros = (contagemCpf[d] ?? 0) - 1;
                                return outros > 0 ? (
                                  <span
                                    className="rounded-full border border-warning/30 bg-warning/15 text-warning px-1.5 py-0 text-[10px] font-semibold"
                                    title={`${outros} outro(s) atendimento(s) no histórico`}
                                  >
                                    🔁 {outros}x
                                  </span>
                                ) : null;
                              })()}
                              {a.cpf && <span className="text-muted-foreground text-xs">{a.cpf}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[meta.tipo, meta.canal, `${dataFmt} ${a.hora ?? ""}`.trim()].filter(Boolean).join(" · ")}
                            </div>
                            {a.observacao && <div className="text-xs text-muted-foreground mt-1">{a.observacao}</div>}
                          </div>
                          <div className="contents" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className={`${STATUS_COLORS[meta.status] ?? STATUS_COLORS["Pendente"]} inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold hover:opacity-90 transition`}
                                title="Trocar status"
                              >
                                {meta.status}
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {statusOptions.map((s) => (
                                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                                  {s}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {isAdmin && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => setEditAt(a)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm("Excluir demanda?")) deleteAtendimento.mutate({ id: a.id, plantao_id: active.id });
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Footer KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t">
              <KPI value={stats.total} label="Atendimentos" big />
              <KPI value={stats.consultas} label="Consultas" big />
              <KPI value={stats.pendencias} label="Pendências" big />
              <KPI value={stats.exames} label="Exames Autoriz." big />
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => setEditPlantao(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar plantão
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Excluir plantão?")) {
                      deletePlantao.mutate(active.id);
                      onOpenChange(false);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
              </div>
            )}
          </div>
          <aside className="min-h-0 min-w-0 h-full border-t md:border-t-0 md:border-l p-4 pt-6" aria-label="Histórico de reincidência">
            <ReincidenciaPanel cpf={cpfReincidencia} fillHeight />
          </aside>
        </DialogContent>
      </Dialog>

      {editAt && (
        <AtendimentoDialog open={!!editAt} onOpenChange={(v) => !v && setEditAt(null)} plantaoId={active.id} atendimento={editAt} />
      )}
      {novoAt && <AtendimentoDialog open={novoAt} onOpenChange={setNovoAt} plantaoId={active.id} />}
      {editPlantao && <PlantaoDialog open={editPlantao} onOpenChange={setEditPlantao} plantao={active} />}
      {novoPlantao && (
        <AdicionarExecutivaDialog
          open={novoPlantao}
          onOpenChange={setNovoPlantao}
          empresaId={plantao.empresa_id}
          data={plantao.data}
        />
      )}
    </>
  );
}

function KPI({ value, label, big }: { value: number; label: string; big?: boolean }) {
  const alerta = label === "Pendências" && value > 0;
  return (
    <div className={`rounded-md border p-3 text-center ${alerta ? "border-warning bg-warning/10" : ""}`}>
      <div className={`${big ? "text-2xl" : "text-xl"} font-bold ${alerta ? "text-warning" : big ? "text-primary" : ""}`}>
        {alerta && "⚠ "}{value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
