import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSignature, Plus, Search, FileText, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ImplantacaoWizard } from "@/components/implantacao/ImplantacaoWizard";

const STATUS_LABEL: Record<string, string> = {
  em_implantacao: "Em implantação",
  aguardando_documentos: "Aguardando documentos",
  em_validacao: "Em validação",
  implantado: "Implantado",
  pendente_ajuste: "Pendente ajuste",
};

const STATUS_COLOR: Record<string, string> = {
  em_implantacao: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  aguardando_documentos: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30",
  em_validacao: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  implantado: "bg-green-500/15 text-green-600 border-green-500/30",
  pendente_ajuste: "bg-red-500/15 text-red-600 border-red-500/30",
};

export default function Implantacao() {
  const { isAdmin, isVendas, role } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = isAdmin || role === "comum";
  const canDelete = isAdmin || isVendas;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["implantacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter !== "todos" && i.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (i.nome_empresa || "").toLowerCase().includes(s) ||
        (i.cnpj || "").toLowerCase().includes(s) ||
        (i.codigo_contrato || "").toLowerCase().includes(s)
      );
    });
  }, [items, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [items]);

  const handleNew = async () => {
    if (!canEdit) return;
    const { data: u } = await supabase.auth.getUser();
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", u.user!.id)
      .maybeSingle();
    const { data, error } = await supabase
      .from("implantacoes_contratos" as any)
      .insert({
        status: "em_implantacao",
        etapa_atual: 1,
        created_by: u.user!.id,
        created_by_nome: prof?.display_name || u.user!.email,
      } as any)
      .select()
      .single();
    if (error) {
      console.error(error);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
    setOpenId((data as any).id);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("excluir_implantacao" as any, { p_id: deleteTarget.id });
      if (error) throw error;
      const paths = ((data as any)?.storage_paths || []) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("implantacao-anexos").remove(paths).catch(() => {});
      }
      toast.success("Implantação excluída");
      queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
      queryClient.invalidateQueries({ queryKey: ["implantacoes-andamento"] });
      queryClient.invalidateQueries({ queryKey: ["implantacao-alertas-count"] });
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir implantação");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileSignature className="h-7 w-7 text-primary" />
              Implantação de Contratos
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Wizard inteligente para implantação contratual com extração automática.
            </p>
          </div>
          {canEdit && (
            <Button onClick={handleNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Implantação
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(["em_implantacao", "aguardando_documentos", "em_validacao", "implantado", "pendente_ajuste"] as const).map((s) => (
            <Card key={s}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[s]}</p>
                <p className="text-2xl font-bold mt-1">{counts[s] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa, CNPJ ou código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* List */}
        {isLoading ? (
          <p className="text-muted-foreground text-center py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Nenhuma implantação encontrada.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((i) => (
              <Card
                key={i.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setOpenId(i.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">
                      {i.nome_empresa || "Sem nome"}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className={STATUS_COLOR[i.status]}>
                        {STATUS_LABEL[i.status]}
                      </Badge>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: i.id, nome: i.nome_empresa || "Sem nome" });
                          }}
                          title="Excluir implantação"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">CNPJ: {i.cnpj || "—"}</p>
                  <p className="text-muted-foreground">Código: {i.codigo_contrato || "—"}</p>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Etapa {i.etapa_atual}/6
                    </span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <span
                          key={n}
                          className={`h-1.5 w-4 rounded-full ${
                            n <= (i.etapa_atual || 1) ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {openId && (
          <ImplantacaoWizard
            id={openId}
            open={!!openId}
            onClose={() => {
              setOpenId(null);
              queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
            }}
            readOnly={!canEdit}
          />
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir implantação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá permanentemente o contrato <strong>{deleteTarget?.nome}</strong>,
                seus anexos, alertas e histórico. Não é possível desfazer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleDelete(); }}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
