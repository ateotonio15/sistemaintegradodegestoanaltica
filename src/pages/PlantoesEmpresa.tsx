import { useState } from "react";
import { Link, useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, FileSpreadsheet, FileText, User, MapPin, ChevronRight, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoes, usePlantaoMutations, usePlantoesRealtime, type Plantao } from "@/hooks/usePlantoes";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { PlantaoDetalheDialog } from "@/components/plantoes/PlantaoDetalheDialog";

const TIPOS_DEMANDA = ["Consulta", "Exames", "Reclamação", "Outros"] as const;

export default function PlantoesEmpresa() {
  const { empresaId } = useParams<{ empresaId: string }>();
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateDemanda = role !== "visualizacao" && role !== "diretora";
  usePlantoesRealtime();
  const { data: empresas = [] } = usePlantaoEmpresas();
  const empresa = empresas.find((e) => e.id === empresaId);
  const { data: plantoes = [] } = usePlantoes({ empresaId });
  const { deletePlantao } = usePlantaoMutations();
  const [edit, setEdit] = useState<Plantao | null>(null);
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<Plantao | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const exportExcel = () => {
    const rows = plantoes.map((p) => ({
      Data: new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR"),
      Turno: p.turno,
      Plantonista: p.plantonista ?? "",
      Atendimentos: p.atendimentos_count ?? 0,
      Observacao: p.observacao ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plantoes");
    XLSX.writeFile(wb, `plantoes_${empresa?.nome ?? "empresa"}_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const exportPDF = () => window.print();

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button asChild variant="outline" size="sm">
            <Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">{empresa?.nome ?? "Empresa"}</h1>
            <p className="text-sm text-muted-foreground">{plantoes.length} plantões registrados</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportExcel}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPDF}>
            <FileText className="h-4 w-4 mr-1" /> PDF
          </Button>
          {isAdmin && (
            <Button onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo plantão
            </Button>
          )}
        </div>
      </div>

      {/* Cards — agrupados por dia */}
      {plantoes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum plantão.</CardContent></Card>
      ) : (() => {
        const grupos = new Map<string, Plantao[]>();
        plantoes.forEach((p) => {
          const arr = grupos.get(p.data) ?? [];
          arr.push(p);
          grupos.set(p.data, arr);
        });
        const dias = Array.from(grupos.entries()).sort((a, b) => b[0].localeCompare(a[0]));
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dias.map(([data, lista]) => {
              const isToday = data === today;
              const dataFmt = new Date(data + "T00:00:00").toLocaleDateString("pt-BR");
              const atend = lista.reduce((s, p) => s + (p.atendimentos_count ?? 0), 0);
              const primeiro = lista[0];
              return (
                <Card key={data} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold">{dataFmt}</div>
                      {isToday ? (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0">EM ANDAMENTO</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">FINALIZADO</Badge>
                      )}
                    </div>

                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" /> PRESENCIAL
                    </Badge>

                    <div className="pt-1">
                      <span className="text-3xl font-bold text-primary">{atend}</span>
                      <span className="text-sm text-muted-foreground ml-2">atendimentos no dia</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <User className="h-3.5 w-3.5" /> Executivas ({lista.length})
                      </div>
                      <div className="space-y-1">
                        {lista.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="truncate font-medium">{p.plantonista || "sem plantonista"}</span>
                            <span className="text-xs text-muted-foreground ml-2">{p.atendimentos_count ?? 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border p-2">
                        <div className="text-lg font-bold">{atend}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consultas</div>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="text-lg font-bold">0</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendências</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <button onClick={() => setDetalhe(primeiro)} className="text-sm text-primary inline-flex items-center hover:underline">
                        Ver detalhes <ChevronRight className="h-4 w-4" />
                      </button>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEdit(primeiro)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Excluir ${lista.length} plantão(ões) do dia ${dataFmt}?`)) {
                                lista.forEach((p) => deletePlantao.mutate(p.id));
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {canCreateDemanda && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Adicionar nova demanda para este plantão"
                            className="w-full gap-1.5 border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 dark:border-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-950/30"
                          >
                            <PlusCircle className="h-4 w-4" />
                            Adicionar demanda
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Tipo de demanda</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {TIPOS_DEMANDA.map((tipo) => (
                            <DropdownMenuItem
                              key={tipo}
                              onClick={() =>
                                navigate("/demandas/nova", {
                                  state: {
                                    plantao_id: primeiro.id,
                                    empresa_id: empresaId,
                                    returnTo: location.pathname,
                                    initial: {
                                      empresa: empresa?.nome ?? "",
                                      executiva: primeiro.plantonista ?? "",
                                      data_reclamacao: data,
                                      tipo_reclamacao: tipo,
                                      atendimento: (primeiro as any).modalidade ?? "presencial",
                                    },
                                  },
                                })
                              }
                            >
                              {tipo}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })()}

      {edit && <PlantaoDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} plantao={edit} />}
      {novo && <PlantaoDialog open={novo} onOpenChange={setNovo} defaultEmpresaId={empresaId} />}
      {detalhe && (
        <PlantaoDetalheDialog
          open={!!detalhe}
          onOpenChange={(v) => !v && setDetalhe(null)}
          plantao={detalhe}
          empresaNome={empresa?.nome}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
