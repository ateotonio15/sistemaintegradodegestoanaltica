import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Plus, X, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NovaFeriasDialog } from "./NovaFeriasDialog";
import { formatDateBR } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusLabel: Record<string, { label: string; cls: string }> = {
  programada: { label: "Programada", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  em_andamento: { label: "Em andamento", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  aguardando_retorno_contratos: { label: "Aguardando retorno", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  encerrada: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
};

export function FeriasSection() {
  const { user, isAdmin, isDiretora, isComum } = useAuth();
  const podeCriar = isAdmin || isDiretora || isComum;
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

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

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("cancelar_ferias_cadastro" as any, { p_ferias_id: id });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({ title: "Férias canceladas", description: `${data?.revertidas ?? 0} empresa(s) devolvida(s) ao responsável original.` });
      qc.invalidateQueries({ queryKey: ["ferias-list"] });
      qc.invalidateQueries({ queryKey: ["cadastro-workload"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
    onError: (e: any) => toast({ title: "Erro ao cancelar", description: e.message, variant: "destructive" }),
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
                const podeCancelar = f.status !== "encerrada" && (isAdmin || isDiretora || (isComum && f.responsavel_original_user_id === user?.id));
                return (
                  <div key={f.id} className="flex items-center justify-between border rounded-lg p-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{f.responsavel_original_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(f.data_inicio)} → {formatDateBR(f.data_fim)} · {emps.length} empresas · {pendentes} pendentes
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                      {podeCancelar && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={cancelar.isPending}>
                              {cancelar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1" />}
                              Cancelar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancelar férias?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Todas as empresas redistribuídas serão devolvidas ao responsável original ({f.responsavel_original_nome}) e o registro será encerrado. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Voltar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => cancelar.mutate(f.id)} className="bg-destructive hover:bg-destructive/90">Confirmar cancelamento</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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
