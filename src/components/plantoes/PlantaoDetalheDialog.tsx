import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  User, Building2, MapPin, ChevronDown, Plus, Pencil, Trash2,
} from "lucide-react";
import { useAtendimentos, usePlantaoMutations, usePlantoes, type Plantao, type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { AtendimentoDialog, parseAssunto } from "@/components/plantoes/AtendimentoDialog";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { AdicionarExecutivaDialog } from "@/components/plantoes/AdicionarExecutivaDialog";

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
  const { deleteAtendimento, deletePlantao } = usePlantaoMutations();
  const [editAt, setEditAt] = useState<PlantaoAtendimento | null>(null);
  const [novoAt, setNovoAt] = useState(false);
  const [editPlantao, setEditPlantao] = useState(false);
  const [demandasOpen, setDemandasOpen] = useState(true);

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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="p-6 space-y-5">
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
                <button
                  onClick={() => setDemandasOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${demandasOpen ? "" : "-rotate-90"}`} />
                  Demandas ({stats.total})
                </button>

                {demandasOpen && (
                  <div className="space-y-2">
                    {isAdmin && (
                      <Button variant="ghost" size="sm" onClick={() => setNovoAt(true)} className="text-primary">
                        <Plus className="h-4 w-4 mr-1" /> Adicionar demanda
                      </Button>
                    )}
                    <div className="divide-y border rounded-md">
                      {atendimentos.length === 0 && (
                        <div className="p-4 text-sm text-muted-foreground text-center">Nenhuma demanda registrada.</div>
                      )}
                      {atendimentos.map((a) => {
                        const meta = parseAssunto(a.assunto, a.resolvido);
                        return (
                        <div key={a.id} className="p-3 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <span className="font-medium">{a.nome_cliente}</span>
                              {a.cpf && <span className="text-muted-foreground ml-2 text-xs">{a.cpf}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {[meta.tipo, meta.canal, `${dataFmt} ${a.hora ?? ""}`.trim()].filter(Boolean).join(" · ")}
                            </div>
                            {a.observacao && <div className="text-xs text-muted-foreground mt-1">{a.observacao}</div>}
                          </div>
                          <Badge className={STATUS_COLORS[meta.status] ?? STATUS_COLORS["Pendente"]}>
                            {meta.status}
                          </Badge>
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
  return (
    <div className="rounded-md border p-3 text-center">
      <div className={big ? "text-2xl font-bold text-primary" : "text-xl font-bold"}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
