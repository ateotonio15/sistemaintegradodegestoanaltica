import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileSignature, Plus, Search, FileText, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ImplantacaoWizard } from "@/components/implantacao/ImplantacaoWizard";
import { AnaliseImplantacaoDialog } from "@/components/implantacao/AnaliseImplantacaoDialog";
import { formatDateBR, formatDay } from "@/lib/date-utils";

type EtapaFiltro = "em_andamento" | "implantados";

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
  const { isAdmin, isVendas, isDiretora, role } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = isAdmin || role === "comum" || role === "administradoras";
  const canDelete = isAdmin || isVendas;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [etapa, setEtapa] = useState<EtapaFiltro>("em_andamento");
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
      const implantacoes = (data || []) as any[];
      const empresaIds = [...new Set(implantacoes.map((item) => item.empresa_id).filter(Boolean))];
      if (empresaIds.length === 0) return implantacoes;

      const { data: empresas, error: empresasError } = await supabase
        .from("empresas")
        .select("id, data_implantacao, data_vencimento_fatura, periodo_movimentacao, email_empresa, email_financeiro_cliente, telefone_empresa, vidas")
        .in("id", empresaIds);
      if (empresasError) throw empresasError;
      const empresasPorId = new Map((empresas || []).map((empresa) => [empresa.id, empresa]));
      return implantacoes.map((item) => ({ ...item, empresa: empresasPorId.get(item.empresa_id) }));
    },
  });

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const emAndamento = i.status !== "implantado";
      const implantado = i.status === "implantado";
      if (etapa === "em_andamento" && !emAndamento) return false;
      if (etapa === "implantados" && !implantado) return false;
      if (statusFilter !== "todos" && i.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (i.nome_empresa || "").toLowerCase().includes(s) ||
        (i.cnpj || "").toLowerCase().includes(s) ||
        (i.codigo_contrato || "").toLowerCase().includes(s)
      );
    });
  }, [items, search, statusFilter, etapa]);

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
    <>
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
          <div className="space-y-3">
            {filtered.map((i) => (
              <Card
                key={i.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setOpenId(i.id)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                    {/* Coluna principal: nome, status, código */}
                    <div className="min-w-0 flex-1 lg:flex-[0_0_22rem]">
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
                      <div className="mt-2 text-sm text-muted-foreground">
                        <p>CNPJ: {i.cnpj || "—"}</p>
                        <p>Código: {i.codigo_contrato || "—"}</p>
                      </div>
                    </div>

                    {/* Coluna de detalhes */}
                    <div className="flex-1 min-w-0">
                      {i.status === "implantado" ? (
                        <ImplantadoResumo implantacao={i} />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                          <p>Vigência: {i.data_vigencia ? formatDateBR(i.data_vigencia) : "—"}</p>
                          <p>Vencimento: {i.data_vencimento ? formatDay(i.data_vencimento) : "—"}</p>
                          <p>Corretora: {i.corretora || "—"}</p>
                          <p>Vidas: {i.total_vidas ?? 0}</p>
                        </div>
                      )}
                    </div>

                    {/* Coluna de etapa */}
                    <div className="lg:flex-[0_0_auto] lg:text-right">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 lg:justify-end">
                        <Clock className="h-3 w-3" />
                        Etapa {i.etapa_atual}/6
                      </span>
                      <div className="flex gap-1 mt-1.5 lg:justify-end">
                        {[1, 2, 3, 4, 5, 6].map((n) => (
                          <span
                            key={n}
                            className={`h-1.5 w-5 rounded-full ${
                              n <= (i.etapa_atual || 1) ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {openId && isDiretora ? (
          <AnaliseImplantacaoDialog
            implantacaoId={openId}
            open={!!openId}
            onClose={() => {
              setOpenId(null);
              queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
            }}
          />
        ) : openId ? (
          <ImplantacaoWizard
            id={openId}
            open={!!openId}
            onClose={() => {
              setOpenId(null);
              queryClient.invalidateQueries({ queryKey: ["implantacoes"] });
            }}
            readOnly={!canEdit}
          />
        ) : null}

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
    </>
  );
}

function ImplantadoResumo({ implantacao: i }: { implantacao: any }) {
  const empresa = i.empresa || {};
  const vidasTotal = i.total_vidas ?? empresa.vidas ?? ((i.vidas_enfermaria || 0) + (i.vidas_apartamento || 0));
  const periodoMovimentacao = i.periodo_movimentacao || empresa.periodo_movimentacao;
  const movimentacao = periodoMovimentacao === "Diário"
    ? `Diário${i.data_corte ? ` · corte dia ${String(i.data_corte).padStart(2, "0")}` : ""}`
    : periodoMovimentacao?.replace("-", " a ").concat(" dias");
  const emails = i.emails_contrato || [empresa.email_empresa, empresa.email_financeiro_cliente].filter(Boolean).join(" · ");
  const vencimento = i.data_vencimento
    ? formatDay(i.data_vencimento)
    : empresa.data_vencimento_fatura != null
      ? String(empresa.data_vencimento_fatura).padStart(2, "0")
      : "—";

  const secao = (label: string, value: React.ReactNode) => (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{value ?? "—"}</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
      {secao("Data de ativação", i.inicio_atendimento ? formatDateBR(i.inicio_atendimento) : (empresa.data_implantacao ? formatDateBR(empresa.data_implantacao) : (i.data_vigencia ? formatDateBR(i.data_vigencia) : "—")))}
      {secao("Vencimento", vencimento)}
      {secao("Movimentações", movimentacao || "—")}
      {secao("E-mail do contrato", emails || "—")}
      {secao("Telefone", i.telefone || empresa.telefone_empresa || "—")}
      {secao("Vidas total", `${vidasTotal || 0} (${i.vidas_enfermaria || 0} enferm. / ${i.vidas_apartamento || 0} apart.)`)}
      {secao("Corretora", i.corretora || "—")}
      {secao("Comissão", `Agenciamento ${i.percentual_agenciamento ?? 0}% com ${i.percentual_vitalicio ?? 0}%`)}
    </div>
  );
}
