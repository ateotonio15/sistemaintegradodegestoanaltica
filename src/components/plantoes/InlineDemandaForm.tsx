import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { type PlantaoAtendimento } from "@/hooks/usePlantoes";
import { parseAssunto } from "@/components/plantoes/AtendimentoDialog";
import { useAuth } from "@/hooks/useAuth";
import DemandaFormDialog from "@/components/demandas/DemandaFormDialog";
import { format } from "date-fns";

export function InlineDemandaForm({
  plantaoIds,
  defaultPlantaoId,
  empresaNome,
  empresaId,
  executivaNome,
  dataPlantao,
}: {
  plantaoIds: string[];
  defaultPlantaoId: string;
  empresaNome?: string;
  empresaId?: string;
  executivaNome?: string;
  dataPlantao?: string;
}) {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  const queries = useQueries({
    queries: plantaoIds.map((id) => ({
      queryKey: ["plantoes", "atendimentos", id],
      enabled: !loading && !!user && !!id,
      queryFn: async () => {
        const { data, error } = await supabase
          .from("plantoes_atendimentos")
          .select("*")
          .eq("plantao_id", id);
        if (error) throw error;
        return data as PlantaoAtendimento[];
      },
    })),
  });

  const atendimentos = queries.flatMap((q) => q.data ?? []);
  const total = atendimentos.length;
  let consultas = 0;
  let pendencias = 0;
  let examesAutoriz = 0;
  atendimentos.forEach((a) => {
    const meta = parseAssunto(a.assunto, a.resolvido);
    const t = meta.tipo.toLowerCase();
    if (t.startsWith("consulta")) consultas++;
    if (t.startsWith("exame") && meta.status === "Resolvido") examesAutoriz++;
    if (meta.status !== "Resolvido" && meta.status !== "Cancelado") pendencias++;
  });

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full gap-1.5 border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 dark:border-pink-900/50 dark:text-pink-300 dark:hover:bg-pink-950/30"
      >
        <Plus className="h-4 w-4" /> Adicionar demanda
      </Button>

      <div className="grid grid-cols-4 gap-2">
        <Kpi label="Atendimentos" value={total} color="text-emerald-600" />
        <Kpi label="Consultas" value={consultas} />
        <Kpi label="Pendências" value={pendencias} color={pendencias > 0 ? "text-amber-600" : ""} />
        <Kpi label="Exames Autoriz." value={examesAutoriz} />
      </div>

      <DemandaFormDialog
        open={open}
        onOpenChange={setOpen}
        plantaoContext={{ plantao_id: defaultPlantaoId, empresa_id: empresaId }}
        initialValues={{
          data_reclamacao: dataPlantao || format(new Date(), "yyyy-MM-dd"),
          empresa: empresaNome || "",
          executiva: executivaNome || "",
          tipo_reclamacao: "Reclamação",
        }}
      />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <div className={`text-lg font-bold ${color ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}
