import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoes, usePlantaoMutations, usePlantoesRealtime, type Plantao } from "@/hooks/usePlantoes";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";

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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/plantoes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
        <div className="text-right">
          <h1 className="text-xl font-bold">{empresa?.nome ?? "Empresa"}</h1>
          <p className="text-xs text-muted-foreground">{plantoes.length} plantões</p>
        </div>
        {isAdmin && <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1" /> Novo plantão</Button>}
      </div>

      <Card><CardContent className="p-0">
        <div className="divide-y">
          {plantoes.length === 0 && <div className="p-6 text-center text-muted-foreground text-sm">Nenhum plantão.</div>}
          {plantoes.map((p) => (
            <div key={p.id} className="p-3 flex items-center justify-between gap-2">
              <Link to={`/plantoes/${p.id}/atendimentos`} className="flex-1 min-w-0">
                <div className="font-medium">{new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")} · {p.turno}</div>
                <div className="text-xs text-muted-foreground">{p.plantonista || "sem plantonista"}</div>
              </Link>
              <Badge variant="outline">{p.atendimentos_count} atend.</Badge>
              {isAdmin && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir plantão?")) deletePlantao.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent></Card>

      {edit && <PlantaoDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} plantao={edit} />}
      {novo && <PlantaoDialog open={novo} onOpenChange={setNovo} defaultEmpresaId={empresaId} />}
    </div>
  );
}
