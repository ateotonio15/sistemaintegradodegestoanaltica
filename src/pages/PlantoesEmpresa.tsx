import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil, FileSpreadsheet, FileText, User, MapPin, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoes, usePlantaoMutations, usePlantoesRealtime, type Plantao } from "@/hooks/usePlantoes";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { PlantaoDetalheDialog } from "@/components/plantoes/PlantaoDetalheDialog";

export default function PlantoesEmpresa() {
  const { empresaId } = useParams<{ empresaId: string }>();
  const { role } = useAuth();
  const isAdmin = role === "admin";
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

      {/* Cards */}
      {plantoes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum plantão.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plantoes.map((p) => {
            const isToday = p.data === today;
            const dataFmt = new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR");
            const atend = p.atendimentos_count ?? 0;
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
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

                  <div className="flex items-start gap-2 text-sm">
                    <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.plantonista || "sem plantonista"}</div>
                      <div className="text-xs text-muted-foreground truncate">{empresa?.nome}</div>
                    </div>
                    <span className="text-sm text-muted-foreground">{atend}</span>
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
                    <button onClick={() => setDetalhe(p)} className="text-sm text-primary inline-flex items-center hover:underline">
                      Ver detalhes <ChevronRight className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir plantão?")) deletePlantao.mutate(p.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {edit && <PlantaoDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} plantao={edit} />}
      {novo && <PlantaoDialog open={novo} onOpenChange={setNovo} defaultEmpresaId={empresaId} />}
    </div>
  );
}
