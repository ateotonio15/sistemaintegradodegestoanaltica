import { Fragment, useMemo, useState } from "react";
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
  ChevronDown,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
} from "lucide-react";
import {
  useAtualizarValorDependenteUea,
  useExcluirTitularUea,
  useTitularesUea,
} from "@/hooks/useDependentesUea";
import { TitularUeaDialog } from "@/components/dependentes-uea/TitularUeaDialog";
import { TitularDetalheUeaDialog } from "@/components/dependentes-uea/TitularDetalheUeaDialog";
import { FaixasUeaDialog } from "@/components/dependentes-uea/FaixasUeaDialog";
import { ImportarVidasUeaDialog } from "@/components/dependentes-uea/ImportarVidasUeaDialog";
import { useMinhaPermissaoUea } from "@/hooks/useUeaPermissoes";
import {
  aplicaFiltro,
  aplicaFiltroMudanca,
  FILTROS_MUDANCA,
  proximasMudancasFaixa,
  type FiltroMudanca,
  buscaTitular,
  DIAS_PROXIMA_FAIXA,
  FILTROS_UEA,
  formatBRL,
  formatCPF,
  formatDataBR,
  parseValorBr,
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
  const { canEditarUea } = useMinhaPermissaoUea();
  const [faixasOpen, setFaixasOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const excluir = useExcluirTitularUea();
  const atualizarValorDependente = useAtualizarValorDependenteUea();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroUea>("todos");
  const [editando, setEditando] = useState<TitularCalculado | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [depsTitular, setDepsTitular] = useState<TitularCalculado | null>(null);
  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [filtroMudanca, setFiltroMudanca] = useState<FiltroMudanca>("90");
  const [valorEditandoId, setValorEditandoId] = useState<string | null>(null);
  const [valorEditandoTxt, setValorEditandoTxt] = useState("");

  const mudancas = useMemo(() => proximasMudancasFaixa(titulares, 90), [titulares]);
  const mudancasFiltradas = useMemo(
    () => mudancas.filter((m) => aplicaFiltroMudanca(m, filtroMudanca)),
    [mudancas, filtroMudanca],
  );

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
          {canEditarUea && (
            <Button variant="outline" onClick={() => setImportarOpen(true)}>
              <Upload className="mr-1.5 h-4 w-4" /> Importar Layout de Vidas
            </Button>
          )}
          {canEditarUea && (
            <Button onClick={() => setNovoOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo titular
            </Button>
          )}
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

      {/* PRÓXIMAS MUDANÇAS DE FAIXA */}
      <Card className="rounded-2xl border-border/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> Próximas mudanças de faixa
            </p>
            <p className="text-xs text-muted-foreground">
              Dependentes ativos que mudarão de valor nos próximos 90 dias.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filtroMudanca} onValueChange={(v) => setFiltroMudanca(v as FiltroMudanca)}>
              <SelectTrigger className="w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTROS_MUDANCA.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline">{mudancasFiltradas.length} dependente(s)</Badge>
          </div>
        </div>
        {mudancasFiltradas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma mudança de faixa prevista para o filtro selecionado.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {mudancasFiltradas.map((m) => (
              <Card
                key={m.dependente_id}
                className={cn(
                  "rounded-xl border-border/60 p-3",
                  m.ficara_sem_margem && "border-destructive/50 bg-destructive/5",
                )}
              >
                <div className="mb-2">
                  <p className="font-semibold uppercase leading-tight">{m.dependente_nome}</p>
                  <p className="text-[11px] text-muted-foreground">Titular: {m.titular_nome}</p>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Data de nascimento</span>
                  <span className="text-right">{formatDataBR(m.data_nascimento)}</span>
                  <span className="text-muted-foreground">Mudança</span>
                  <span className="text-right font-medium">
                    {formatDataBR(m.data_mudanca)} · em {m.dias} dia(s)
                  </span>
                  <span className="text-muted-foreground">Valor atual</span>
                  <span className="text-right">{formatBRL(m.valor_atual)}</span>
                  <span className="text-muted-foreground">Novo valor</span>
                  <span className="text-right font-medium">{formatBRL(m.novo_valor)}</span>
                  <span className="text-muted-foreground">Diferença</span>
                  <span className="text-right font-medium">
                    {m.diferenca >= 0 ? "+ " : "- "}
                    {formatBRL(Math.abs(m.diferenca))}
                  </span>
                  <span className="text-muted-foreground">Margem atual do titular</span>
                  <span className="text-right">{formatBRL(m.margem_atual)}</span>
                  <span className="text-muted-foreground">Margem após reajuste</span>
                  <span
                    className={cn(
                      "text-right font-medium",
                      m.ficara_sem_margem && "text-destructive",
                    )}
                  >
                    {formatBRL(m.margem_apos)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      m.ficara_sem_margem
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/10 text-success",
                    )}
                  >
                    {m.ficara_sem_margem ? (
                      <>
                        <AlertTriangle className="h-3 w-3" /> Ficará sem margem
                      </>
                    ) : (
                      "Possui margem"
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const t = titulares.find((x) => x.id === m.titular_id);
                      if (t) setDepsTitular(t);
                    }}
                  >
                    Ver titular
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

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
              <TableHead className="w-10" />
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
                  <Fragment key={t.id}>
                    <TableRow
                      className={cn(
                        "hover:bg-muted/40",
                        t.requer_analise_faixa && "bg-warning/10 hover:bg-warning/15",
                        !t.requer_analise_faixa && t.margem_restante < 0 && "bg-destructive/5",
                      )}
                    >
                      <TableCell className="w-10">
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          onClick={() => setExpandidoId((cur) => (cur === t.id ? null : t.id))}
                          title={expandidoId === t.id ? "Recolher dependentes" : "Ver dependentes"}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              expandidoId === t.id && "rotate-180",
                            )}
                          />
                        </button>
                      </TableCell>
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
                          t.requer_analise_faixa
                            ? "bg-warning/15 text-warning"
                            : STATUS_CLS[t.status_margem],
                        )}
                      >
                        {t.status_exibicao}
                      </span>
                      {t.margem_restante < 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Ultrapassa em {formatBRL(t.excedente_margem)}
                        </div>
                      )}
                      {t.requer_analise_faixa && (
                        <div className="mt-1 text-[11px] text-warning">
                          Nova mensalidade ultrapassa a margem disponível.
                        </div>
                      )}
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
                          {formatDataBR(prox.data)} · {prox.label}
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
                        {canEditarUea && (
                          <>
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
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandidoId === t.id && (
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={10} className="p-0">
                        <div className="border-l-2 border-primary/50 px-6 py-4">
                          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            Dependentes deste titular
                            <Badge variant="outline" className="ml-1">
                              {t.dependentes_calculados.length}
                            </Badge>
                          </div>
                          {t.dependentes_calculados.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              Nenhum dependente cadastrado para este titular.
                            </p>
                          ) : (
                            <div className="overflow-hidden rounded-lg border border-border/60">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40">
                                    <TableHead>Dependente</TableHead>
                                    <TableHead>Carteirinha</TableHead>
                                    <TableHead>Nascimento / Idade</TableHead>
                                    <TableHead>Faixa atual</TableHead>
                                    <TableHead className="text-right">Mensalidade</TableHead>
                                    <TableHead>Próxima mudança</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {t.dependentes_calculados.map((d) => (
                                    <TableRow
                                      key={d.id}
                                      className={cn(
                                        "hover:bg-muted/30",
                                        d.status !== "ativo" && "opacity-60",
                                      )}
                                    >
                                      <TableCell>
                                        <div className="font-medium">{d.nome_completo}</div>
                                        {d.parentesco && (
                                          <div className="text-[11px] text-muted-foreground">
                                            {d.parentesco}
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="font-mono text-xs">
                                        {d.carteirinha ?? "—"}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {d.data_nascimento
                                          ? `${formatDataBR(d.data_nascimento)} · ${
                                              d.idade_atual != null ? `${d.idade_atual} anos` : "—"
                                            }`
                                          : "—"}
                                      </TableCell>
                                      <TableCell className="text-xs">{d.faixa_atual_label}</TableCell>
                                      <TableCell className="text-right">
                                        {valorEditandoId === d.id ? (
                                          <div className="ml-auto flex w-[260px] items-center gap-1.5">
                                            <Input
                                              autoFocus
                                              inputMode="decimal"
                                              className="h-8 text-right"
                                              value={valorEditandoTxt}
                                              onChange={(e) => setValorEditandoTxt(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === "Escape") setValorEditandoId(null);
                                                if (e.key === "Enter") {
                                                  const valor = parseValorBr(valorEditandoTxt);
                                                  atualizarValorDependente
                                                    .mutateAsync({ dependente: d, valor_mensal: valor })
                                                    .then(() => setValorEditandoId(null));
                                                }
                                              }}
                                            />
                                            <Button
                                              size="sm"
                                              className="h-8"
                                              disabled={atualizarValorDependente.isPending}
                                              onClick={async () => {
                                                const valor = parseValorBr(valorEditandoTxt);
                                                await atualizarValorDependente.mutateAsync({
                                                  dependente: d,
                                                  valor_mensal: valor,
                                                });
                                                setValorEditandoId(null);
                                              }}
                                            >
                                              Salvar
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8"
                                              title="Cancelar"
                                              onClick={() => setValorEditandoId(null)}
                                            >
                                              ×
                                            </Button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1.5">
                                            <span>{formatBRL(d.valor_mensal)}</span>
                                            {canEditarUea && (
                                              <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                title="Editar valor do dependente"
                                                onClick={() => {
                                                  setValorEditandoId(d.id);
                                                  setValorEditandoTxt(
                                                    Number(d.valor_mensal || 0)
                                                      .toFixed(2)
                                                      .replace(".", ","),
                                                  );
                                                }}
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                            )}
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs">
                                        {d.data_proxima_mudanca ? (
                                          <span>
                                            {formatDataBR(d.data_proxima_mudanca)}
                                            {d.proximo_valor != null && (
                                              <span className="text-muted-foreground">
                                                {" "}
                                                → {formatBRL(d.proximo_valor)}
                                              </span>
                                            )}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <span
                                          className={cn(
                                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                                            d.status === "ativo"
                                              ? "bg-success/10 text-success"
                                              : "bg-destructive/10 text-destructive",
                                          )}
                                        >
                                          {d.status_label}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
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
        podeEditar={canEditarUea}
      />
      <FaixasUeaDialog open={faixasOpen} onOpenChange={setFaixasOpen} />
      <ImportarVidasUeaDialog open={importarOpen} onOpenChange={setImportarOpen} faixas={faixas} />

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
