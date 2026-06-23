import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plane, Plus, X, Loader2, Pencil } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NovaFeriasDialog } from "./NovaFeriasDialog";
import { EditarFeriasEmpresasDialog } from "./EditarFeriasEmpresasDialog";
import { formatDateBR } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusLabel: Record<string, { label: string; cls: string }> = {
  programada: { label: "Programada", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  em_andamento: { label: "Em andamento", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  aguardando_retorno_contratos: { label: "Aguardando retorno", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  encerrada: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
};

export function FeriasButton() {
  const { user, isAdmin, isDiretora, isComum } = useAuth();
  const podeCriar = isAdmin || isDiretora || isComum;
  const [novaOpen, setNovaOpen] = useState(false);
  const [editar, setEditar] = useState<{ id: string; nome: string; userId: string } | null>(null);
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

  const ativas = ferias.filter((f: any) => f.status !== "encerrada");

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
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="rounded-lg gap-2 relative">
            <Plane className="h-4 w-4" />
            Férias
            {ativas.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{ativas.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[420px] p-0">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plane className="h-4 w-4 text-primary" />
              Gestão de Férias — Cadastro
            </div>
            {podeCriar && (
              <Button size="sm" onClick={() => setNovaOpen(true)} className="h-7 rounded-md">
                <Plus className="h-3.5 w-3.5 mr-1" />Férias
              </Button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {ferias.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma férias registrada.</p>
            ) : (
              <div className="space-y-2">
                {ferias.map((f: any) => {
                  const s = statusLabel[f.status] ?? { label: f.status, cls: "" };
                  const emps = (f.ferias_cadastro_empresas ?? []) as { status: string }[];
                  const pendentes = emps.filter((e) => e.status !== "retornada").length;
                  const podeCancelar = f.status !== "encerrada" && (isAdmin || isDiretora || (isComum && f.responsavel_original_user_id === user?.id));
                  return (
                    <div key={f.id} className="border rounded-lg p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{f.responsavel_original_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateBR(f.data_inicio)} → {formatDateBR(f.data_fim)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {emps.length} contratos · {pendentes} pendentes
                          </p>
                        </div>
                        <Badge variant="outline" className={`${s.cls} shrink-0`}>{s.label}</Badge>
                      </div>
                      {podeCancelar && (
                        <div className="flex justify-end gap-1 mt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            onClick={() => setEditar({ id: f.id, nome: f.responsavel_original_nome, userId: f.responsavel_original_user_id })}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive" disabled={cancelar.isPending}>
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <NovaFeriasDialog open={novaOpen} onClose={() => setNovaOpen(false)} />
      <EditarFeriasEmpresasDialog
        open={!!editar}
        onOpenChange={(v) => !v && setEditar(null)}
        feriasId={editar?.id ?? null}
        responsavelOriginalNome={editar?.nome}
        responsavelOriginalUserId={editar?.userId}
      />
    </>
  );
}
