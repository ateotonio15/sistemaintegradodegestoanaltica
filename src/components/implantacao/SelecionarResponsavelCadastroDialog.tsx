import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (userId: string, userNome: string) => void;
  loading?: boolean;
}

export function SelecionarResponsavelCadastroDialog({ open, onClose, onConfirm, loading }: Props) {
  const [sel, setSel] = useState<{ id: string; nome: string } | null>(null);

  const { data: cadastros = [], isLoading } = useQuery({
    queryKey: ["cadastro-users-workload"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_comum_users_empresa_count" as any);
      if (error) throw error;
      const list = (data as any[]) ?? [];

      const ids = list.map((u) => u.user_id);
      if (ids.length === 0) return [];

      const { data: impls } = await supabase
        .from("implantacoes_contratos" as any)
        .select("responsavel_cadastro_user_id, status")
        .in("responsavel_cadastro_user_id", ids)
        .not("status", "in", "(implantado,rejeitado)");

      const implMap = new Map<string, number>();
      (impls as any[] ?? []).forEach((i) => {
        const k = i.responsavel_cadastro_user_id;
        implMap.set(k, (implMap.get(k) ?? 0) + 1);
      });

      return list.map((u) => ({
        user_id: u.user_id,
        display_name: u.display_name ?? "Sem nome",
        empresas: Number(u.empresa_count ?? 0),
        implantacoes: implMap.get(u.user_id) ?? 0,
      }));
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Atribuir ao responsável de Cadastro
          </DialogTitle>
          <DialogDescription>
            Escolha o usuário do Cadastro que receberá este contrato para implantação final.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : cadastros.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nenhum usuário Cadastro encontrado.</p>
        ) : (
          <div className="grid gap-2 max-h-[55vh] overflow-y-auto pr-1">
            {cadastros
              .sort((a, b) => (a.empresas + a.implantacoes) - (b.empresas + b.implantacoes))
              .map((u) => {
                const ativo = sel?.id === u.user_id;
                return (
                  <Card
                    key={u.user_id}
                    onClick={() => setSel({ id: u.user_id, nome: u.display_name })}
                    className={cn(
                      "p-3 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm",
                      ativo && "border-primary ring-2 ring-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
                          ativo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {ativo ? <CheckCircle2 className="h-5 w-5" /> : <Users className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{u.display_name}</p>
                          <p className="text-xs text-muted-foreground">Carga total: {u.empresas + u.implantacoes}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Badge variant="secondary" className="gap-1">
                          <Building2 className="h-3 w-3" /> {u.empresas}
                        </Badge>
                        <Badge variant="outline" className="gap-1 border-blue-500/30 text-blue-600">
                          {u.implantacoes} impl.
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button
            disabled={!sel || loading}
            onClick={() => sel && onConfirm(sel.id, sel.nome)}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Atribuir e aprovar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
