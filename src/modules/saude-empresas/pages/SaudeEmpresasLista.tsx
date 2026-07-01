import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, Plus, Search, LayoutGrid, List, HeartPulse, Trash2, X, BarChart3, Stethoscope, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/date-utils";
import { toast } from "sonner";
import { NovaAcaoDialog } from "../components/NovaAcaoDialog";
import { useSaudeRealtime } from "../hooks/useSaudeEmpresas";

const ALL = "__todos__";
const sb = supabase as any;

type AcaoRow = {
  id: string;
  empresa_id: string;
  data_acao: string;
  tem_pa: boolean;
  tem_glicemia: boolean;
  tem_bioimpedancia: boolean;
  empresa?: { id: string; nome: string } | null;
};

type Resumo = {
  empresa_id: string;
  nome: string;
  totalAcoes: number;
  totalTriagens: number;
  ultimaAcao: string | null;
  tipos: { pa: boolean; gli: boolean; bio: boolean };
  acaoIds: string[];
};

export default function SaudeEmpresasLista() {
  useSaudeRealtime();
  const navigate = useNavigate();
  const { isAdmin, isEnfermeira, isExecutivo, isDiretora } = useAuth();
  const canCreate = isAdmin || isEnfermeira || isExecutivo;
  const canDelete = isAdmin || isEnfermeira || isExecutivo;

  const [acoes, setAcoes] = useState<AcaoRow[]>([]);
  const [triagens, setTriagens] = useState<Array<{ id: string; acao_id: string }>>([]);
  const [empresas, setEmpresas] = useState<Array<{ id: string; nome: string }>>([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState(ALL);
  const [filtroTipo, setFiltroTipo] = useState<string>(ALL);
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [delEmpresa, setDelEmpresa] = useState<Resumo | null>(null);

  async function atualizar() {
    setLoading(true);
    try {
      const [a, t, e] = await Promise.all([
        sb.from("acoes_saude").select("id,empresa_id,data_acao,tem_pa,tem_glicemia,tem_bioimpedancia, empresa:empresas(id,nome)"),
        sb.from("triagens").select("id,acao_id"),
        sb.from("empresas").select("id,nome").eq("status_empresa", "Ativa").order("nome"),
      ]);
      if (a.error) throw a.error;
      if (t.error) throw t.error;
      if (e.error) throw e.error;
      setAcoes((a.data ?? []) as AcaoRow[]);
      setTriagens((t.data ?? []) as any);
      setEmpresas((e.data ?? []) as any);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { atualizar(); }, []);

  const triagensPorAcao = useMemo(() => {
    const m = new Map<string, number>();
    triagens.forEach((t) => m.set(t.acao_id, (m.get(t.acao_id) ?? 0) + 1));
    return m;
  }, [triagens]);

  const resumoTodos = useMemo<Resumo[]>(() => {
    const map = new Map<string, Resumo>();
    acoes.forEach((a) => {
      const nome = a.empresa?.nome ?? "—";
      const key = a.empresa_id;
      const cur = map.get(key) ?? {
        empresa_id: key, nome,
        totalAcoes: 0, totalTriagens: 0, ultimaAcao: null,
        tipos: { pa: false, gli: false, bio: false }, acaoIds: [],
      };
      cur.totalAcoes += 1;
      cur.totalTriagens += triagensPorAcao.get(a.id) ?? 0;
      cur.acaoIds.push(a.id);
      if (!cur.ultimaAcao || a.data_acao > cur.ultimaAcao) cur.ultimaAcao = a.data_acao;
      cur.tipos.pa = cur.tipos.pa || !!a.tem_pa;
      cur.tipos.gli = cur.tipos.gli || !!a.tem_glicemia;
      cur.tipos.bio = cur.tipos.bio || !!a.tem_bioimpedancia;
      map.set(key, cur);
    });
    return Array.from(map.values()).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR"));
  }, [acoes, triagensPorAcao]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return resumoTodos.filter((r) => {
      if (filtroEmpresa !== ALL && r.empresa_id !== filtroEmpresa) return false;
      if (filtroTipo === "pa" && !r.tipos.pa) return false;
      if (filtroTipo === "gli" && !r.tipos.gli) return false;
      if (filtroTipo === "bio" && !r.tipos.bio) return false;
      if (dataIni || dataFim) {
        // pelo menos uma ação da empresa dentro do intervalo
        const hasInRange = acoes.some((a) =>
          a.empresa_id === r.empresa_id &&
          (!dataIni || a.data_acao >= dataIni) &&
          (!dataFim || a.data_acao <= dataFim)
        );
        if (!hasInRange) return false;
      }
      if (q && !r.nome.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [resumoTodos, busca, filtroEmpresa, filtroTipo, dataIni, dataFim, acoes]);

  const totalTri = useMemo(() => filtrados.reduce((s, r) => s + r.totalTriagens, 0), [filtrados]);

  function limparFiltros() {
    setBusca(""); setFiltroEmpresa(ALL); setFiltroTipo(ALL); setDataIni(""); setDataFim("");
  }

  async function confirmarExclusao() {
    if (!delEmpresa) return;
    try {
      const { error } = await sb.from("acoes_saude").delete().in("id", delEmpresa.acaoIds);
      if (error) throw error;
      toast.success(`"${delEmpresa.nome}" removida (${delEmpresa.acaoIds.length} ação/ões)`);
      setDelEmpresa(null);
      atualizar();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao excluir");
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ações Saúde nas Empresas</h1>
            <p className="text-sm text-muted-foreground tabular-nums">
              {filtrados.length} {filtrados.length === 1 ? "empresa" : "empresas"} • {totalTri} {totalTri === 1 ? "triagem registrada" : "triagens registradas"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline"><Link to="/saude-empresas/visao-geral"><BarChart3 className="h-4 w-4 mr-1" />Visão geral</Link></Button>
          {canCreate && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Nova ação
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." className="pl-8" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL}>Todas as empresas</SelectItem>
              {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo de aferição" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os tipos</SelectItem>
              <SelectItem value="pa">PA</SelectItem>
              <SelectItem value="gli">Glicemia</SelectItem>
              <SelectItem value="bio">Bioimpedância</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>

          <div className="lg:col-span-5 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <X className="h-4 w-4 mr-1" />Limpar
            </Button>
            <div className="flex border rounded-md p-0.5">
              <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")}>
                <LayoutGrid className="h-4 w-4 mr-1" />Grade
              </Button>
              <Button size="sm" variant={view === "list" ? "secondary" : "ghost"} onClick={() => setView("list")}>
                <List className="h-4 w-4 mr-1" />Lista
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <HeartPulse className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
          </CardContent>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((r) => (
            <Card
              key={r.empresa_id}
              className="group relative hover:shadow-md cursor-pointer transition-shadow"
              onClick={() => navigate(`/saude-empresas/empresa/${r.empresa_id}`)}
            >
              {canDelete && (
                <button
                  onClick={(ev) => { ev.stopPropagation(); setDelEmpresa(r); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 rounded-md p-1.5"
                  aria-label="Excluir empresa"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 pr-8">
                  <span className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="truncate">{r.nome}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ações</span><span className="font-semibold tabular-nums">{r.totalAcoes}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Beneficiários atendidos</span><span className="font-semibold tabular-nums">{r.totalTriagens}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Última ação</span><span className="font-medium">{r.ultimaAcao ? formatDateBR(r.ultimaAcao) : "—"}</span></div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {r.tipos.pa && <Badge variant="secondary">PA</Badge>}
                  {r.tipos.gli && <Badge variant="secondary">Glicemia</Badge>}
                  {r.tipos.bio && <Badge variant="secondary">Bio</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                  <TableHead className="text-right">Triagens</TableHead>
                  <TableHead>Última ação</TableHead>
                  <TableHead>Tipos</TableHead>
                  {canDelete && <TableHead className="w-16" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => (
                  <TableRow
                    key={r.empresa_id}
                    className="hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/saude-empresas/empresa/${r.empresa_id}`)}
                  >
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.totalAcoes}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.totalTriagens}</TableCell>
                    <TableCell>{r.ultimaAcao ? formatDateBR(r.ultimaAcao) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.tipos.pa && <Badge variant="secondary">PA</Badge>}
                        {r.tipos.gli && <Badge variant="secondary">Glicemia</Badge>}
                        {r.tipos.bio && <Badge variant="secondary">Bio</Badge>}
                      </div>
                    </TableCell>
                    {canDelete && (
                      <TableCell>
                        <button
                          onClick={(ev) => { ev.stopPropagation(); setDelEmpresa(r); }}
                          className="text-destructive hover:bg-destructive/10 rounded-md p-1.5"
                          aria-label="Excluir empresa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <NovaAcaoDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSaved={(id) => { setModalOpen(false); atualizar(); if (id) navigate(`/saude-empresas/acao/${id}`); }}
      />

      <AlertDialog open={!!delEmpresa} onOpenChange={(o) => !o && setDelEmpresa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa "{delEmpresa?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as ações de saúde e triagens vinculadas a esta empresa serão removidas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
