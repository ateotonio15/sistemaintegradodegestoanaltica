import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarDays, FileBarChart2, Phone, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePlantaoEmpresas, usePlantoes, usePlantoesRealtime } from "@/hooks/usePlantoes";
import { PlantaoEmpresaDialog } from "@/components/plantoes/PlantaoEmpresaDialog";
import { PlantaoDialog } from "@/components/plantoes/PlantaoDialog";
import { PlantaoLoteDialog } from "@/components/plantoes/PlantaoLoteDialog";

export default function Plantoes() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  usePlantoesRealtime();

  const today = new Date().toISOString().slice(0, 10);
  const { data: empresas = [] } = usePlantaoEmpresas();
  const { data: plantoesHoje = [] } = usePlantoes({ from: today, to: today });

  const [empDialog, setEmpDialog] = useState(false);
  const [plantaoDialog, setPlantaoDialog] = useState(false);
  const [loteDialog, setLoteDialog] = useState(false);

  const porEmpresa = useMemo(() => {
    const map = new Map<string, { nome: string; total: number; plantonista: string | null; semPlantonista: boolean; plantaoId: string | null }>();
    for (const e of empresas) {
      map.set(e.id, { nome: e.nome, total: 0, plantonista: null, semPlantonista: false, plantaoId: null });
    }
    for (const p of plantoesHoje) {
      const cur = map.get(p.empresa_id);
      if (!cur) continue;
      cur.total += p.atendimentos_count ?? 0;
      cur.plantonista = cur.plantonista ?? p.plantonista;
      if (!p.plantonista) cur.semPlantonista = true;
      cur.plantaoId = cur.plantaoId ?? p.id;
    }
    return Array.from(map.entries()).map(([id, v]) => ({ empresaId: id, ...v }));
  }, [empresas, plantoesHoje]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" /> Plantões 24h
          </h1>
          <p className="text-sm text-muted-foreground">Atendimentos do dia · {new Date().toLocaleDateString("pt-BR")}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/plantoes/calendario"><CalendarDays className="h-4 w-4 mr-1" /> Calendário</Link></Button>
          <Button asChild variant="outline"><Link to="/plantoes/relatorios"><FileBarChart2 className="h-4 w-4 mr-1" /> Relatórios</Link></Button>
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setEmpDialog(true)}><Building2 className="h-4 w-4 mr-1" /> Empresa</Button>
              <Button variant="outline" onClick={() => setLoteDialog(true)}><Users className="h-4 w-4 mr-1" /> Novo lote</Button>
              <Button onClick={() => setPlantaoDialog(true)}><Plus className="h-4 w-4 mr-1" /> Plantão</Button>
            </>
          )}
        </div>
      </header>

      {porEmpresa.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhuma empresa cadastrada. {isAdmin && "Use o botão Empresa para cadastrar a primeira."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {porEmpresa.map((e) => (
            <Link key={e.empresaId} to={`/plantoes/empresa/${e.empresaId}`} className="block">
              <Card className="rounded-xl border bg-card hover:border-primary/60 transition card-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold">{e.nome}</div>
                    {e.plantaoId ? (
                      <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">Em plantão</Badge>
                    ) : (
                      <Badge variant="outline" className="uppercase text-[10px] tracking-wider">Sem plantão</Badge>
                    )}
                  </div>
                  <div className="text-3xl font-bold">{e.total}</div>
                  <div className="text-xs text-muted-foreground">atendimentos hoje</div>
                  <div className="text-xs">
                    Plantonista: <span className="font-medium">{e.plantonista || "—"}</span>
                  </div>
                  {e.semPlantonista && e.plantaoId && (
                    <Badge variant="destructive" className="text-[10px]">Sem plantonista</Badge>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {empDialog && <PlantaoEmpresaDialog open={empDialog} onOpenChange={setEmpDialog} />}
      {plantaoDialog && <PlantaoDialog open={plantaoDialog} onOpenChange={setPlantaoDialog} />}
      {loteDialog && <PlantaoLoteDialog open={loteDialog} onOpenChange={setLoteDialog} />}
    </div>
  );
}
