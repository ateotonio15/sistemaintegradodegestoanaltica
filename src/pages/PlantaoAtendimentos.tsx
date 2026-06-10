import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAtendimentos, usePlantaoMutations, usePlantoesRealtime, type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { AtendimentoDialog } from "@/components/plantoes/AtendimentoDialog";

export default function PlantaoAtendimentos() {
  const { plantaoId } = useParams<{ plantaoId: string }>();
  const { role, user, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";
  usePlantoesRealtime();

  const { data: plantao } = useQuery({
    queryKey: ["plantao-detail", plantaoId],
    enabled: !authLoading && !!user && !!plantaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plantoes")
        .select("*, empresa:plantoes_empresas(*)")
        .eq("id", plantaoId!)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: atendimentos = [] } = useAtendimentos(plantaoId);
  const { deleteAtendimento } = usePlantaoMutations();
  const [edit, setEdit] = useState<PlantaoAtendimento | null>(null);
  const [novo, setNovo] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to={plantao ? `/plantoes/empresa/${plantao.empresa_id}` : "/plantoes"}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Link>
        </Button>
        <div className="text-right">
          <h1 className="text-xl font-bold">{plantao?.empresa?.nome}</h1>
          <p className="text-xs text-muted-foreground">
            {plantao && `${new Date(plantao.data + "T00:00:00").toLocaleDateString("pt-BR")} · ${plantao.turno} · ${plantao.plantonista || "sem plantonista"}`}
          </p>
        </div>
        {isAdmin && <Button onClick={() => setNovo(true)}><Plus className="h-4 w-4 mr-1" /> Atendimento</Button>}
      </div>

      <Card><CardContent className="p-0">
        <div className="divide-y">
          {atendimentos.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Sem atendimentos registrados.</div>}
          {atendimentos.map((a) => (
            <div key={a.id} className="p-3 flex items-center gap-3">
              {a.resolvido ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <div className="text-sm font-mono w-14">{a.hora ?? "--:--"}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{a.nome_cliente}</div>
                <div className="text-xs text-muted-foreground truncate">{a.assunto || "—"} {a.cpf && `· CPF ${a.cpf}`}</div>
              </div>
              <Badge variant={a.resolvido ? "secondary" : "outline"} className="uppercase text-[10px] tracking-wider">
                {a.resolvido ? "Resolvido" : "Em aberto"}
              </Badge>
              {isAdmin && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) deleteAtendimento.mutate({ id: a.id, plantao_id: plantaoId! }); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </CardContent></Card>

      {edit && plantaoId && <AtendimentoDialog open={!!edit} onOpenChange={(v) => !v && setEdit(null)} plantaoId={plantaoId} atendimento={edit} />}
      {novo && plantaoId && <AtendimentoDialog open={novo} onOpenChange={setNovo} plantaoId={plantaoId} />}
    </div>
  );
}
