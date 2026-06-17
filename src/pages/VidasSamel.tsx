import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HeartPulse, Users as UsersIcon, User, Search, Filter, RefreshCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  listVidas, login, setUnauthorizedHandler, getSavedCredentials, saveCredentials, getToken,
  listAllVidasParaContratos,
} from "@/lib/vidasSamelApi";
import type { Beneficiario, VidasFilters } from "@/types/vidasSamel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download } from "lucide-react";


function formatDateBR(s?: string | null): string {
  if (!s) return "—";
  const onlyDate = String(s).slice(0, 10);
  const parts = onlyDate.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return String(s);
}

function situacaoBadge(s?: string) {
  const v = (s || "").toUpperCase();
  if (v.includes("ATIVO")) return <Badge className="bg-success text-success-foreground hover:bg-success">{s}</Badge>;
  if (v.includes("CANCEL") || v.includes("RESCIND")) return <Badge variant="destructive">{s}</Badge>;
  if (v.includes("SUSPEN")) return <Badge className="bg-warning text-warning-foreground hover:bg-warning">{s}</Badge>;
  return <Badge variant="secondary">{s || "—"}</Badge>;
}

interface FormFilters {
  nm_beneficiario: string;
  nm_estipulante: string;
  carteirinha: string;
  nr_contrato: string;
  ds_plano: string;
  ds_situacao_atual: string;
  ie_titular_dependente: string;
  ie_suspenso: string;
}

const emptyFilters: FormFilters = {
  nm_beneficiario: "", nm_estipulante: "", carteirinha: "", nr_contrato: "",
  ds_plano: "", ds_situacao_atual: "", ie_titular_dependente: "all", ie_suspenso: "all",
};

function toApiFilters(f: FormFilters, page: number, pageSize: number): VidasFilters {
  return {
    page, pageSize,
    nm_beneficiario: f.nm_beneficiario || undefined,
    nm_estipulante: f.nm_estipulante || undefined,
    carteirinha: f.carteirinha || undefined,
    nr_contrato: f.nr_contrato || undefined,
    ds_plano: f.ds_plano || undefined,
    ds_situacao_atual: f.ds_situacao_atual || undefined,
    ie_titular_dependente: f.ie_titular_dependente !== "all" ? f.ie_titular_dependente : undefined,
    ie_suspenso: f.ie_suspenso !== "all" ? f.ie_suspenso : undefined,
  };
}

export default function VidasSamel() {
  const [draft, setDraft] = useState<FormFilters>(emptyFilters);
  const [applied, setApplied] = useState<FormFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showFilters, setShowFilters] = useState(true);
  const [selected, setSelected] = useState<Beneficiario | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginForm, setLoginForm] = useState(getSavedCredentials());
  const [loggingIn, setLoggingIn] = useState(false);

  // Auto login on first mount when no token
  useEffect(() => {
    setUnauthorizedHandler(() => setLoginOpen(true));
    if (!getToken()) {
      setLoginOpen(true);
    }
    return () => setUnauthorizedHandler(null);
  }, []);

  const apiFilters = useMemo(() => toApiFilters(applied, page, pageSize), [applied, page, pageSize]);

  const mainQuery = useQuery({
    queryKey: ["vidas-samel", apiFilters],
    queryFn: () => listVidas(apiFilters),
    retry: 1,
  });

  useEffect(() => {
    if (mainQuery.error) toast.error((mainQuery.error as Error).message);
  }, [mainQuery.error]);

  // KPIs: titulares + dependentes (independente dos filtros aplicados)
  const titularesQuery = useQuery({
    queryKey: ["vidas-samel-kpi", "T"],
    queryFn: () => listVidas({ page: 1, pageSize: 1, ie_titular_dependente: "T" }),
    enabled: !!getToken() || loginOpen === false,
  });
  const dependentesQuery = useQuery({
    queryKey: ["vidas-samel-kpi", "D"],
    queryFn: () => listVidas({ page: 1, pageSize: 1, ie_titular_dependente: "D" }),
    enabled: !!getToken() || loginOpen === false,
  });

  const total = mainQuery.data?.pagination.total ?? 0;
  const totalPages = mainQuery.data?.pagination.totalPages ?? 1;
  const rows = mainQuery.data?.data ?? [];
  const titulares = titularesQuery.data?.pagination.total ?? 0;
  const dependentes = dependentesQuery.data?.pagination.total ?? 0;
  const totalVidas = titulares + dependentes;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  function applyFilters() {
    setPage(1);
    setApplied(draft);
  }
  function clearFilters() {
    setDraft(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  }

  async function doManualLogin() {
    setLoggingIn(true);
    try {
      await login(loginForm);
      saveCredentials(loginForm);
      setLoginOpen(false);
      toast.success("Login realizado");
      mainQuery.refetch();
      titularesQuery.refetch();
      dependentesQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || "Falha no login");
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <HeartPulse className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Vidas Samel</h1>
              <p className="text-sm text-muted-foreground">Consulta de beneficiários por contrato (TASY)</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="vidas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vidas">Vidas</TabsTrigger>
            <TabsTrigger value="contratos">Contratos por classificação</TabsTrigger>
          </TabsList>

          <TabsContent value="vidas" className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="Vidas Ativas" value={totalVidas} icon={HeartPulse} accent="text-primary" bg="bg-primary/10" loading={titularesQuery.isLoading || dependentesQuery.isLoading} />
          <KpiCard label="Titulares" value={titulares} icon={User} accent="text-success" bg="bg-success/10" loading={titularesQuery.isLoading} />
          <KpiCard label="Dependentes" value={dependentes} icon={UsersIcon} accent="text-info" bg="bg-info/10" loading={dependentesQuery.isLoading} />
        </div>


        {/* Filtros */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex items-center gap-2 text-sm font-semibold text-foreground"
                onClick={() => setShowFilters((v) => !v)}
              >
                <Filter className="h-4 w-4" />
                Filtros
              </button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <RefreshCcw className="h-4 w-4 mr-1" /> Limpar
                </Button>
                <Button size="sm" onClick={applyFilters}>
                  <Search className="h-4 w-4 mr-1" /> Aplicar filtros
                </Button>
              </div>
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Field label="Nome do beneficiário">
                  <Input value={draft.nm_beneficiario} onChange={(e) => setDraft({ ...draft, nm_beneficiario: e.target.value })} />
                </Field>
                <Field label="Estipulante">
                  <Input value={draft.nm_estipulante} onChange={(e) => setDraft({ ...draft, nm_estipulante: e.target.value })} />
                </Field>
                <Field label="Carteirinha">
                  <Input value={draft.carteirinha} onChange={(e) => setDraft({ ...draft, carteirinha: e.target.value })} />
                </Field>
                <Field label="Nº Contrato">
                  <Input value={draft.nr_contrato} onChange={(e) => setDraft({ ...draft, nr_contrato: e.target.value })} />
                </Field>
                <Field label="Plano">
                  <Input value={draft.ds_plano} onChange={(e) => setDraft({ ...draft, ds_plano: e.target.value })} />
                </Field>
                <Field label="Situação">
                  <Input placeholder="Ex.: ATIVO" value={draft.ds_situacao_atual} onChange={(e) => setDraft({ ...draft, ds_situacao_atual: e.target.value })} />
                </Field>
                <Field label="Tipo">
                  <Select value={draft.ie_titular_dependente} onValueChange={(v) => setDraft({ ...draft, ie_titular_dependente: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="T">Titular</SelectItem>
                      <SelectItem value="D">Dependente</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Suspenso">
                  <Select value={draft.ie_suspenso} onValueChange={(v) => setDraft({ ...draft, ie_suspenso: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="S">Sim</SelectItem>
                      <SelectItem value="N">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Nome</TableHead>
                    <TableHead>Carteirinha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="min-w-[180px]">Titular</TableHead>
                    <TableHead className="min-w-[160px]">Plano</TableHead>
                    <TableHead className="min-w-[200px]">Estipulante</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead>Adesão</TableHead>
                    <TableHead>Idade</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mainQuery.isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 10 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                        Nenhum beneficiário encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={`${r.CD_PESSOA_FISICA ?? idx}-${idx}`}>
                        <TableCell className="font-medium">{r.NM_BENEFICIARIO || "—"}</TableCell>
                        <TableCell>{r.CARTEIRINHA || "—"}</TableCell>
                        <TableCell>{r.IE_TITULAR_DEPENDENTE === "T" ? "Titular" : r.IE_TITULAR_DEPENDENTE === "D" ? "Dependente" : "—"}</TableCell>
                        <TableCell>{r.NM_TITULAR || "—"}</TableCell>
                        <TableCell>{r.DS_PLANO || "—"}</TableCell>
                        <TableCell>{r.NM_ESTIPULANTE || "—"}</TableCell>
                        <TableCell>{situacaoBadge(r.DS_SITUACAO_ATUAL)}</TableCell>
                        <TableCell>{formatDateBR(r.DT_ADESAO)}</TableCell>
                        <TableCell>{r.IDADE ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Ver detalhes</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {start}–{end} de {total} resultados
              </p>
              <div className="flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                  <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n} / pág</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" disabled={page <= 1 || mainQuery.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" disabled={page >= totalPages || mainQuery.isFetching} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="contratos" className="space-y-4">
            <ContratosClassificacaoTab />
          </TabsContent>
        </Tabs>
      </div>


      {/* Detalhes Drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.NM_BENEFICIARIO || "Beneficiário"}</SheetTitle>
            <SheetDescription>Detalhes completos do beneficiário</SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="mt-6 space-y-6">
              <DetailSection title="Beneficiário" rows={[
                ["Nome", selected.NM_BENEFICIARIO],
                ["CPF (CD_PESSOA_FISICA)", selected.CD_PESSOA_FISICA],
                ["Gênero", selected.IE_SEXO],
                ["Data de Nascimento", formatDateBR(selected.DT_NASCIMENTO)],
                ["Idade", selected.IDADE],
                ["Faixa Etária", selected.FAIXA_ETARIA],
                ["Parentesco", selected.GRAU_PARENTESCO],
                ["Tipo", selected.IE_TITULAR_DEPENDENTE === "T" ? "Titular" : selected.IE_TITULAR_DEPENDENTE === "D" ? "Dependente" : selected.IE_TITULAR_DEPENDENTE],
                ["Titular", selected.NM_TITULAR],
                ["Carteirinha", selected.CARTEIRINHA],
              ]} />
              <DetailSection title="Contrato" rows={[
                ["Nº Contrato", selected.NR_CONTRATO],
                ["Sequência Contrato", selected.NR_SEQ_CONTRATO],
                ["Data do Contrato", formatDateBR(selected.DT_CONTRATO)],
                ["Estipulante", selected.NM_ESTIPULANTE],
                ["Subestipulante", selected.NM_SUBESTIPULANTE],
                ["Plano", selected.DS_PLANO],
                ["Classificação", selected.DS_CLASSIFICACAO],
              ]} />
              <DetailSection title="Adesão / Rescisão" rows={[
                ["Adesão", formatDateBR(selected.DT_ADESAO)],
                ["Rescisão", formatDateBR(selected.DT_RESCISAO)],
                ["Motivo Rescisão", selected.MTV_RESCISAO],
                ["Reativação", formatDateBR(selected.DT_REATIVACAO)],
                ["Funcionário", selected.IE_FUNCIONARIO],
                ["Situação", selected.DS_SITUACAO_ATUAL],
              ]} />
              <DetailSection title="Suspensão" rows={[
                ["Suspenso", selected.IE_SUSPENSO === "S" ? "Sim" : selected.IE_SUSPENSO === "N" ? "Não" : selected.IE_SUSPENSO],
                ["Data Suspensão", formatDateBR(selected.DT_SUSPENSAO)],
                ["Motivo Suspensão", selected.MTV_SUSPENSAO],
                ["Lote Suspensão", selected.LOTE_SUSPENSAO],
              ]} />
              <DetailSection title="Pagador" rows={[
                ["Cód. Pagador", selected.CD_PAGADOR],
                ["Nome Pagador", selected.NM_PAGADOR],
                ["Dia Vencimento", selected.DIA_VENCIMENTO],
                ["CCO", selected.CCO],
              ]} />
              <DetailSection title="Continuidade" rows={[
                ["Continuidade", selected.IE_CONTINUIDADE],
                ["Início Continuidade", formatDateBR(selected.DT_INIC_CONTINUIDADE)],
                ["Limite Continuidade", formatDateBR(selected.DT_LIMITE_CONTINUIDADE)],
              ]} />
              <DetailSection title="Corretor" rows={[
                ["Corretor", selected.CORRETOR],
                ["Sequência Corretor", selected.NR_SEQ_CORRETOR],
              ]} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Login dialog */}
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login Vidas Samel</DialogTitle>
            <DialogDescription>Informe as credenciais de acesso à API.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Usuário">
              <Input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
            </Field>
            <Field label="Senha">
              <Input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={doManualLogin} disabled={loggingIn}>
              {loggingIn ? "Entrando..." : "Entrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent, bg, loading }: { label: string; value: number; icon: any; accent: string; bg: string; loading?: boolean }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`h-5 w-5 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? <Skeleton className="h-6 w-16 mt-1" /> : <p className="text-xl font-bold tracking-tight text-foreground">{value.toLocaleString("pt-BR")}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailSection({ title, rows }: { title: string; rows: Array<[string, any]> }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground mb-2">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 rounded-lg border p-3 bg-card/50">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className="text-sm text-foreground break-words">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
