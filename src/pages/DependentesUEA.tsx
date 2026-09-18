import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import { useExcluirTitularUea, useTitularesUea } from "@/hooks/useDependentesUea";
import { TitularUeaDialog } from "@/components/dependentes-uea/TitularUeaDialog";
import { TitularDetalheUeaDialog } from "@/components/dependentes-uea/TitularDetalheUeaDialog";
import { FaixasUeaDialog } from "@/components/dependentes-uea/FaixasUeaDialog";
import {
  aplicaFiltro,
  buscaTitular,
  DIAS_PROXIMA_FAIXA,
  FILTROS_UEA,
  formatBRL,
  formatCPF,
  formatDataBR,
  type FiltroUea,
  type StatusMargem,
  type TitularCalculado,
} from "@/lib/dependentes-uea";

const STATUS_CLS: Record<StatusMargem, string> = {
  "Sem dependentes": "bg-muted text-muted-foreground",
  "Com margem": "bg-success/10 text-success",
  "Margem comprometida": "bg-warning/10 text-warning",
  "Sem margem": "bg-destructive/10 text-destructive",
};

function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "primary" | "success" | "warning" | "destructive" | "muted";
}) {
  const tones: Record<string, string> = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/10",
    destructive: "text-destructive bg-destructive/10",
    muted: "text-muted-foreground bg-muted",
  };
  return (
    <Card className="flex items-center gap-3 rounded-2xl border-border/60 bg-card/80 p-3.5 shadow-sm">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-bold leading-tight tracking-tight">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
        {hint && <p className="truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </Card>
  );
}

export default function DependentesUEA() {
  const { titulares, faixas, isLoading } = useTitularesUea();
  const [faixasOpen, setFaixasOpen] = useState(false);
  const excluir = useExcluirTitularUea();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroUea>("todos");
  const [editando, setEditando] = useState<TitularCalculado | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [depsTitular, setDepsTitular] = useState<TitularCalculado | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const lista = useMemo(
    () => titulares.filter((t) => buscaTitular(t, busca) && aplicaFiltro(t, filtro)),
    [titulares, busca, filtro],
  );

  const kpis = useMemo(() => {
    const ativos = titulares.reduce((a, t) => a + t.quantidade_dependentes_ativos, 0);
    const desligados = titulares.reduce((a, t) => a + t.quantidade_dependentes_desligados, 0);
    const valorTotal = titulares.reduce((a, t) => a + t.valor_total_dependentes_ativos, 0);
    return {
      totalTitulares: titulares.length,
      ativos,
      desligados,
      valorTotal,
      semMargem: titulares.filter((t) => t.status_margem === "Sem margem").length,
      comMargem: titulares.filter((t) => t.status_margem === "Com margem").length,
    };
  }, [titulares]);

  const titularAtual = depsTitular
    ? titulares.find((t) => t.id === depsTitular.id) ?? depsTitular
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dependentes UEA</h1>
          <p className="text-sm text-muted-foreground">
            Controle dos valores cobrados dos titulares conforme dependentes ativos, faixa etária e
            margem disponível.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setFaixasOpen(true)}>
            <Settings2 className="mr-1.5 h-4 w-4" /> Faixas etárias e valores
          </Button>
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo titular
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard label="Total de Titulares" value={kpis.totalTitulares} icon={<Users className="h-5 w-5" />} />
        <KpiCard
          label="Dependentes Ativos"
          value={kpis.ativos}
          icon={<UserCheck className="h-5 w-5" />}
          tone="success"
        />
        <KpiCard
          label="Dependentes Desligados"
          value={kpis.desligados}
          icon={<UserMinus className="h-5 w-5" />}
          tone="muted"
        />
        <KpiCard
          label="Valor Mensal Total"
          value={formatBRL(kpis.valorTotal)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <KpiCard
          label="Titulares sem Margem"
          value={kpis.semMargem}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="destructive"
        />
        <KpiCard
          label="Com Margem Disponível"
          value={kpis.comMargem}
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <Card className="rounded-2xl border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Pesquisar por nome, CPF ou matrícula"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroUea)}>
            <SelectTrigger className="w-[320px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTROS_UEA.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline">{lista.length} titular(es)</Badge>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titular</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-center">Dependentes Ativos</TableHead>
              <TableHead className="text-right">Valor dos Dependentes</TableHead>
              <TableHead className="text-right">Margem Restante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Próxima Mudança de Faixa</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {titulares.length === 0
                      ? "Nenhum titular cadastrado ainda."
                      : "Nenhum titular encontrado para a pesquisa e o filtro selecionados."}
                  </p>
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              lista.map((t) => {
                const prox = t.proxima_mudanca_faixa;
                const proxProxima = !!prox && prox.dias <= DIAS_PROXIMA_FAIXA;
                return (
                  <TableRow key={t.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="font-medium">{t.nome_completo}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {[t.matricula && `Matrícula ${t.matricula}`, t.contrato && `Contrato ${t.contrato}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell>{formatCPF(t.cpf)}</TableCell>
                    <TableCell className="text-right">{formatBRL(t.valor_margem)}</TableCell>
                    <TableCell className="text-center">
                      <button
                        className="underline-offset-2 hover:underline"
                        onClick={() => setDepsTitular(t)}
                      >
                        {t.quantidade_dependentes_ativos}
                        {t.quantidade_dependentes_desligados > 0 && (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            (+{t.quantidade_dependentes_desligados} desl.)
                          </span>
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatBRL(t.valor_total_dependentes_ativos)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        t.margem_restante < 0 && "text-destructive",
                      )}
                    >
                      {formatBRL(t.margem_restante)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                          STATUS_CLS[t.status_margem],
                        )}
                      >
                        {t.status_margem}
                      </span>
                    </TableCell>
                    <TableCell>
                      {prox ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-xs",
                            proxProxima ? "text-warning" : "text-muted-foreground",
                          )}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatDataBR(prox.data)} · {prox.faixa_atual} → {prox.proxima_faixa}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setDepsTitular(t)} title="Dependentes">
                          <Users className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditando(t)} title="Editar titular">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setExcluirId(t.id)}
                          title="Excluir titular"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </Card>

      <TitularUeaDialog open={novoOpen} onOpenChange={setNovoOpen} />
      <TitularUeaDialog
        open={!!editando}
        onOpenChange={(v) => !v && setEditando(null)}
        titular={editando}
      />
      <TitularDetalheUeaDialog
        open={!!depsTitular}
        onOpenChange={(v) => !v && setDepsTitular(null)}
        titular={titularAtual}
        faixas={faixas}
      />
      <FaixasUeaDialog open={faixasOpen} onOpenChange={setFaixasOpen} />

      <AlertDialog open={!!excluirId} onOpenChange={(v) => !v && setExcluirId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir titular?</AlertDialogTitle>
            <AlertDialogDescription>
              Os dependentes vinculados a este titular também serão removidos. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluirId) excluir.mutate(excluirId);
                setExcluirId(null);
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
