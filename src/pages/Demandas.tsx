import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  Edit2,
  FileUp,
  Gauge,
  History,
  MessageSquareWarning,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDemandas, useDeleteDemanda } from "@/hooks/useDemandas";
import {
  formatDate,
  getDiasAberto,
  getStatus,
  isOverSla,
  type Demanda,
} from "@/lib/demandas-utils";
import DemandaFormDialog from "@/components/demandas/DemandaFormDialog";
import ImportarDemandasDialog from "@/components/demandas/ImportarDemandasDialog";
import HistoricoImportacoesDialog from "@/components/demandas/HistoricoImportacoesDialog";

type StatusFilter = "todos" | "em_aberto" | "resolvido";

export default function Demandas() {
  const { isAdmin, isDiretora, isViewOnly, isExecutivo, isExecutivoExterno, user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const reclamacaoParam = params.get("reclamacao");
  const idParam = params.get("id");

  const { data: demandas = [], isLoading } = useDemandas();
  const del = useDeleteDemanda();

  // Filtros
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [empresa, setEmpresa] = useState<string>("__all__");
  const [setor, setSetor] = useState<string>("__all__");
  const [executiva, setExecutiva] = useState<string>("__all__");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [busca, setBusca] = useState("");

  // Dialogs
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Demanda | null>(null);
  const [openImport, setOpenImport] = useState(false);
  const [openHist, setOpenHist] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Demanda | null>(null);

  // Drilldown via ?id= → abre o formulário do registro
  useEffect(() => {
    if (!idParam || demandas.length === 0) return;
    const d = demandas.find((x) => x.id === idParam);
    if (d) {
      setEditing(d);
      setOpenForm(true);
      const next = new URLSearchParams(params);
      next.delete("id");
      setParams(next, { replace: true });
    }
  }, [idParam, demandas]);

  // Perfil para checar propriedade
  const { data: profile } = useQuery({
    queryKey: ["profile-display", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });
  const profileName = (profile?.display_name || "").trim().toLowerCase();
  const canEditRow = (d: Demanda) => {
    if (isAdmin) return true;
    if (isDiretora || isViewOnly) return false;
    if (isExecutivo || isExecutivoExterno) return true;
    return (d.executiva || "").trim().toLowerCase() === profileName && profileName.length > 0;
  };

  // Unifica variações do mesmo nome (ex.: "Ana Beatriz" e "Ana Beatriz dos Santos Nogueira").
  // Se os tokens de um nome estão contidos em outro, agrupa e usa o mais longo como canônico.
  const executivaCanonicalMap = useMemo(() => {
    const norm = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !["dos", "das", "de", "da", "do"].includes(t));
    const raw = Array.from(new Set(demandas.map((d) => (d.executiva || "").trim()).filter(Boolean)));
    const tokens = raw.map((n) => ({ n, t: new Set(norm(n)) }));
    tokens.sort((a, b) => b.t.size - a.t.size); // mais longo primeiro
    const map: Record<string, string> = {};
    const canonicos: string[] = [];
    for (const { n, t } of tokens) {
      let matched: string | null = null;
      for (const c of canonicos) {
        const ct = new Set(norm(c));
        // subset em qualquer direção (compartilham pelo menos 2 tokens em comum)
        const inter = [...t].filter((x) => ct.has(x));
        const subset = inter.length >= Math.min(t.size, ct.size) && inter.length >= 2;
        if (subset) {
          matched = c;
          break;
        }
      }
      if (matched) map[n] = matched;
      else {
        canonicos.push(n);
        map[n] = n;
      }
    }
    return map;
  }, [demandas]);

  const canonicalExecutiva = (nome: string | null | undefined) =>
    executivaCanonicalMap[(nome || "").trim()] || (nome || "").trim();

  const opts = useMemo(() => {
    const setSet = new Set<string>();
    const empSet = new Set<string>();
    const exeSet = new Set<string>();
    demandas.forEach((d) => {
      if (d.empresa) empSet.add(d.empresa);
      if (d.setor_responsavel) setSet.add(d.setor_responsavel);
      if (d.executiva) exeSet.add(canonicalExecutiva(d.executiva));
    });
    return {
      empresas: Array.from(empSet).sort(),
      setores: Array.from(setSet).sort(),
      executivas: Array.from(exeSet).sort(),
    };
  }, [demandas, executivaCanonicalMap]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return demandas.filter((d) => {
      if (dataIni && d.data_reclamacao < dataIni) return false;
      if (dataFim && d.data_reclamacao > dataFim) return false;
      if (empresa !== "__all__" && d.empresa !== empresa) return false;
      if (setor !== "__all__" && d.setor_responsavel !== setor) return false;
      if (executiva !== "__all__" && canonicalExecutiva(d.executiva) !== executiva) return false;
      if (status !== "todos") {
        const st = getStatus(d);
        if (status === "em_aberto" && st !== "Pendente") return false;
        if (status === "resolvido" && st !== "Resolvida" && st !== "Finalizada") return false;
      }
      if (reclamacaoParam && d.reclamacao !== reclamacaoParam) return false;
      if (q && !d.nome_cliente.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [demandas, dataIni, dataFim, empresa, setor, executiva, status, busca, reclamacaoParam]);

  const limparFiltros = () => {
    setDataIni("");
    setDataFim("");
    setEmpresa("__all__");
    setSetor("__all__");
    setExecutiva("__all__");
    setStatus("todos");
    setBusca("");
  };

  const exportExcel = () => {
    const rows = filtered.map((d) => ({
      "Data da Reclamação": formatDate(d.data_reclamacao),
      "Beneficiário": d.nome_cliente,
      "Empresa": d.empresa || "",
      "Setor": d.setor_responsavel || "",
      "Tipo": d.tipo_reclamacao || "",
      "Reclamação": d.reclamacao || "",
      "Executiva": d.executiva || "",
      "Detalhamento": d.detalhamento || "",
      "CPF": d.cpf || "",
      "Data de Entrada": formatDate(d.data_entrada),
      "Nome do Médico": d.nome_medico || "",
      "Nome do Procedimento": d.nome_procedimento || "",
      "Encaminhado ao Setor": d.encaminhado_setor ? "Sim" : "Não",
      "Resolvido pelo Setor": d.resolvido_setor ? "Sim" : "Não",
      "Data Resolução (Setor)": formatDate(d.data_resolucao_setor),
      "Resolvido pela Executiva": d.resolvido_executiva ? "Sim" : "Não",
      "Data Resolução (Executiva)": formatDate(d.data_resolucao_executiva),
      "Status": getStatus(d),
      "Dias em aberto": getDiasAberto(d),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reclamações");
    XLSX.writeFile(wb, `reclamacoes_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-[1400px] mx-auto space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
        <div className="flex flex-col gap-1">
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Voltar ao início
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/15">
                <MessageSquareWarning className="h-5 w-5" />
              </div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
                Registro de Reclamações
              </h1>
            </div>
            <Badge variant="secondary" className="text-xs">
              {filtered.length} registro{filtered.length === 1 ? "" : "s"}
            </Badge>
            {reclamacaoParam && (
              <Badge variant="outline" className="gap-1">
                Filtro: {reclamacaoParam}
              </Badge>
            )}
          </div>
        </div>

        {!isDiretora && (
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={() => setOpenImport(true)} className="gap-1.5">
                  <FileUp className="h-4 w-4" />
                  Importar planilha
                </Button>
                <Button variant="outline" size="sm" onClick={() => setOpenHist(true)} className="gap-1.5">
                  <History className="h-4 w-4" />
                  Histórico
                </Button>
              </>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to="/demandas/dashboard">
                  <Gauge className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            {!isViewOnly && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  navigate("/demandas/nova", {
                    state: {
                      returnTo: "/demandas",
                      initial: {
                        tipo_reclamacao: "Reclamação",
                        executiva: profile?.display_name || "",
                      },
                    },
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Nova demanda
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data inicial</label>
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} className="h-9" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Data final</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
          <SelectFilter
            label="Empresa"
            value={empresa}
            onChange={setEmpresa}
            options={opts.empresas}
            allLabel="Todas"
          />
          <SelectFilter
            label="Setor"
            value={setor}
            onChange={setSetor}
            options={opts.setores}
            allLabel="Todos"
          />
          <SelectFilter
            label="Executiva(o)"
            value={executiva}
            onChange={setExecutiva}
            options={opts.executivas}
            allLabel="Todas"
          />
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="em_aberto">Em aberto</SelectItem>
                <SelectItem value="resolvido">Resolvido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Busca</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Beneficiário..."
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Limpar filtros
          </Button>
        </div>
      </Card>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left py-2.5 px-3">Data</th>
                <th className="text-left py-2.5 px-3">Beneficiário</th>
                <th className="text-left py-2.5 px-3">Empresa</th>
                <th className="text-left py-2.5 px-3">Setor</th>
                <th className="text-left py-2.5 px-3">Tipo</th>
                <th className="text-left py-2.5 px-3">Reclamação</th>
                <th className="text-left py-2.5 px-3">Executiva</th>
                <th className="text-left py-2.5 px-3">Status</th>
                <th className="text-right py-2.5 px-3">Dias em aberto</th>
                {!isDiretora && <th className="text-right py-2.5 px-3 w-24">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-muted-foreground">
                    Nenhuma demanda encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const dias = getDiasAberto(d);
                  const over = isOverSla(d);
                  const st = getStatus(d);
                  const canEdit = canEditRow(d);
                  return (
                    <tr
                      key={d.id}
                      className="border-t border-border/60 hover:bg-accent/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(d.data_reclamacao)}</td>
                      <td className="py-2.5 px-3 font-medium">{d.nome_cliente}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{d.empresa || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{d.setor_responsavel || "—"}</td>
                      <td className="py-2.5 px-3 text-muted-foreground">{d.tipo_reclamacao || "—"}</td>
                      <td className="py-2.5 px-3 max-w-[220px] truncate" title={d.reclamacao || ""}>
                        {d.reclamacao || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">{d.executiva || "—"}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          className={cn(
                            "text-[10px] uppercase tracking-wider font-semibold border-transparent",
                            st === "Finalizada"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                              : st === "Resolvida"
                              ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20",
                          )}
                        >
                          {st}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          "py-2.5 px-3 text-right tabular-nums",
                          over && "text-rose-600 dark:text-rose-400 font-bold",
                        )}
                      >
                        {dias}
                      </td>
                      {!isDiretora && (
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={!canEdit}
                              title={canEdit ? "Editar" : "Sem permissão"}
                              onClick={() => {
                                setEditing(d);
                                setOpenForm(true);
                              }}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              disabled={!canEdit}
                              title={canEdit ? "Excluir" : "Sem permissão"}
                              onClick={() => setConfirmDel(d)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <DemandaFormDialog open={openForm} onOpenChange={setOpenForm} demanda={editing} />
      <ImportarDemandasDialog open={openImport} onOpenChange={setOpenImport} />
      <HistoricoImportacoesDialog open={openHist} onOpenChange={setOpenHist} />

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A demanda de <b>{confirmDel?.nome_cliente}</b> será
              removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  await del.mutateAsync(confirmDel.id);
                  toast.success("Demanda excluída");
                  setConfirmDel(null);
                } catch (e: any) {
                  toast.error(e?.message || "Erro ao excluir");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
