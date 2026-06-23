import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  feriasId: string | null;
  responsavelOriginalNome?: string;
  responsavelOriginalUserId?: string;
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  pendente_inicio: { label: "Pendente", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  redistribuida: { label: "Redistribuída", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  aguardando_fechamento: { label: "Aguardando", cls: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30" },
  retornada: { label: "Retornada", cls: "bg-muted text-muted-foreground" },
};

export function EditarFeriasEmpresasDialog({ open, onOpenChange, feriasId, responsavelOriginalNome, responsavelOriginalUserId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: empresas = [], isLoading } = useQuery({
    queryKey: ["ferias-empresas-edit", feriasId],
    enabled: !!feriasId && open,
    queryFn: async () => {
      const { data: fce, error } = await supabase
        .from("ferias_cadastro_empresas" as any)
        .select("id, empresa_id, status, responsavel_temporario_user_id, responsavel_temporario_nome")
        .eq("ferias_id", feriasId!)
        .order("created_at");
      if (error) throw error;
      const rows = (fce ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.empresa_id)));
      let empMap = new Map<string, any>();
      if (ids.length > 0) {
        const { data: emps, error: e2 } = await supabase
          .from("empresas")
          .select("id, nome, codigo_contrato")
          .in("id", ids);
        if (e2) throw e2;
        empMap = new Map((emps ?? []).map((e: any) => [e.id, e]));
      }
      return rows.map((r) => ({ ...r, empresa: empMap.get(r.empresa_id) ?? null }));
    },
  });

  const { data: cadastros = [] } = useQuery({
    queryKey: ["cadastro-workload-edit"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cadastro_workload" as any);
      if (error) throw error;
      return (data ?? []) as { user_id: string; display_name: string }[];
    },
  });

  const reatribuir = useMutation({
    mutationFn: async ({ fceId, userId }: { fceId: string; userId: string }) => {
      const { data, error } = await supabase.rpc("reatribuir_ferias_empresa" as any, {
        p_fce_id: fceId,
        p_new_user_id: userId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Responsável atualizado" });
      qc.invalidateQueries({ queryKey: ["ferias-empresas-edit", feriasId] });
      qc.invalidateQueries({ queryKey: ["ferias-list"] });
      qc.invalidateQueries({ queryKey: ["ferias-em-andamento"] });
      qc.invalidateQueries({ queryKey: ["empresas-dashboard"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes-dashboard"] });
      qc.invalidateQueries({ queryKey: ["movimentacoes"] });
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["comum-users-empresa-count"] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const opcoes = cadastros.filter((c) => c.user_id !== responsavelOriginalUserId);

  const resumo = (() => {
    const map = new Map<string, { nome: string; count: number }>();
    empresas.forEach((e) => {
      const uid = e.responsavel_temporario_user_id ?? "—";
      const nome = e.responsavel_temporario_nome ?? "—";
      const cur = map.get(uid) ?? { nome, count: 0 };
      cur.count++;
      map.set(uid, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Editar redistribuição</DialogTitle>
          <DialogDescription>
            Altere quem está cuidando de cada contrato durante as férias{responsavelOriginalNome ? ` de ${responsavelOriginalNome}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {resumo.length > 0 && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Resumo por Cadastro ({empresas.length} contratos)
            </p>
            <div className="flex flex-wrap gap-2">
              {resumo.map((r) => (
                <Badge key={r.nome} variant="outline" className="gap-1.5">
                  <span>{r.nome}</span>
                  <span className="font-bold tabular-nums text-primary">{r.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma empresa redistribuída.</p>
          ) : (
            empresas.map((e) => {
              const s = statusLabel[e.status] ?? { label: e.status, cls: "" };
              const disabled = e.status === "retornada" || reatribuir.isPending;
              return (
                <div key={e.id} className="flex items-center gap-3 border rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.empresa?.nome ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.empresa?.codigo_contrato ? `#${e.empresa.codigo_contrato} · ` : ""}atual: <span className="font-medium text-foreground">{e.responsavel_temporario_nome ?? "—"}</span>
                    </p>
                  </div>
                  <Badge variant="outline" className={s.cls}>{s.label}</Badge>
                  <Select
                    value={e.responsavel_temporario_user_id ?? undefined}
                    onValueChange={(v) => reatribuir.mutate({ fceId: e.id, userId: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Trocar responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoes.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>{c.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
