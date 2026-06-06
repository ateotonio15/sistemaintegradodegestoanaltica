import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NovaFeriasDialog } from "./NovaFeriasDialog";
import { formatDateBR } from "@/lib/date-utils";

const statusLabel: Record<string, { label: string; cls: string }> = {
  programada: { label: "Programada", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  em_andamento: { label: "Em andamento", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  aguardando_retorno_contratos: { label: "Aguardando retorno", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  encerrada: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
};

export function FeriasSection() {
  const { isAdmin, isDiretora } = useAuth();
  const podeCriar = isAdmin || isDiretora;
  const [open, setOpen] = useState(false);

  const { data: ferias = [] } = useQuery({
    queryKey: ["ferias-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ferias_cadastro" as any)
        .select("*, ferias_cadastro_empresas(status)")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Plane className="h-5 w-5 text-primary" />Gestão de Férias — Cadastro</CardTitle>
          {podeCriar && (
            <Button size="sm" onClick={() => setOpen(true)} className="rounded-lg">
              <Plus className="h-4 w-4 mr-2" />Férias
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {ferias.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma férias registrada.</p>
          ) : (
            <div className="space-y-2">
              {ferias.map((f) => {
                const s = statusLabel[f.status] ?? { label: f.status, cls: "" };
                const emps = (f.ferias_cadastro_empresas ?? []) as { status: string }[];
                const pendentes = emps.filter((e) => e.status !== "retornada").length;
                return (
                  <div key={f.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div>
                      <p className="font-medium">{f.responsavel_original_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(f.data_inicio)} → {formatDateBR(f.data_fim)} · {emps.length} empresas · {pendentes} pendentes
                      </p>
                    </div>
                    <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <NovaFeriasDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
