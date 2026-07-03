import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  AlertTriangle,
  Percent,
  Target,
  Clock,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useDemandas } from "@/hooks/useDemandas";
import {
  parseLocalDate,
  formatDate,
  type Demanda,
} from "@/lib/demandas-utils";
import { normalizarReclamacao } from "@/lib/constants";

/* ============================================================
   SLA / Regras
============================================================ */
const PRAZO_PADRAO_HORAS = 72;
const PRAZO_AGENDA_CIRURGICA_HORAS = 168;
const META_DEVOLUTIVAS_FORA_PRAZO = 8; // %

const HORAS_DIA = 24;
const isAgendaCirurgica = (s?: string | null) =>
  (s || "").toLowerCase().includes("agenda cir");

const prazoHorasOf = (d: Demanda) =>
  isAgendaCirurgica(d.setor_responsavel)
    ? PRAZO_AGENDA_CIRURGICA_HORAS
    : PRAZO_PADRAO_HORAS;

const isResolved = (d: Demanda) =>
  Boolean(d.resolvido_setor || d.resolvido_executiva);

const dataFimEfetiva = (d: Demanda): Date =>
  parseLocalDate(d.data_resolucao_executiva || "") ||
  parseLocalDate(d.data_resolucao_setor || "") ||
  new Date();

function diasDecorridos(d: Demanda): number {
  const ini = parseLocalDate(d.data_reclamacao);
  if (!ini) return 0;
  const fim = dataFimEfetiva(d);
  return Math.max(0, (fim.getTime() - ini.getTime()) / 86400000);
}

const prazoEmDias = (d: Demanda) => prazoHorasOf(d) / HORAS_DIA;
const isForaDoPrazo = (d: Demanda) => diasDecorridos(d) > prazoEmDias(d);

/* ============================================================
   Helpers
============================================================ */
const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const firstDayOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth(), 1);
const lastDayOfMonth = (d = new Date()) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0);

const mmYY = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;

/* ============================================================
   Página
============================================================ */
export default function DemandasForaDoPrazo() {
  const { data: demandas = [], isLoading } = useDemandas();

  const [dataIni, setDataIni] = useState<string>(toISO(firstDayOfMonth()));
  const [dataFim, setDataFim] = useState<string>(toISO(lastDayOfMonth()));
  const [empresa, setEmpresa] = useState<string>("__all__");
  const [executiva, setExecutiva] = useState<string>("__all__");

  const empresas = useMemo(
    () =>
      Array.from(
        new Set(demandas.map((d) => d.empresa).filter(Boolean)),
      ).sort() as string[],
    [demandas],
  );
  const executivas = useMemo(
    () =>
      Array.from(
        new Set(demandas.map((d) => d.executiva).filter(Boolean)),
      ).sort() as string[],
    [demandas],
  );

  const ini = parseLocalDate(dataIni);
  const fim = parseLocalDate(dataFim);

  const filtered = useMemo(() => {
    return demandas.filter((d) => {
      const abertura = parseLocalDate(d.data_reclamacao);
      if (!abertura) return false;
      // Considera a demanda "ativa" no período se sua vigência intersecta
      // com o intervalo: abriu até o fim do período E ainda estava aberta
      // dentro do intervalo (ou foi resolvida dentro dele).
      const resolvida = isResolved(d);
      const encerramento = resolvida ? dataFimEfetiva(d) : new Date();
      if (fim && abertura > fim) return false;
      if (ini && encerramento < ini) return false;
      if (empresa !== "__all__" && d.empresa !== empresa) return false;
      if (executiva !== "__all__" && d.executiva !== executiva) return false;
      return true;
    });
  }, [demandas, dataIni, dataFim, empresa, executiva]);

  const fora = useMemo(
    () =>
      filtered
        .filter(isForaDoPrazo)
        .slice()
        .sort((a, b) => {
          const da = parseLocalDate(a.data_reclamacao)?.getTime() ?? 0;
          const db = parseLocalDate(b.data_reclamacao)?.getTime() ?? 0;
          return da - db;
        }),
    [filtered],
  );

  const total = filtered.length;
  const totalFora = fora.length;
  const pctFora = total ? (totalFora / total) * 100 : 0;
  const acimaMeta = pctFora > META_DEVOLUTIVAS_FORA_PRAZO;
  const mediaAtraso = useMemo(() => {
    if (!fora.length) return 0;
    const soma = fora.reduce(
      (acc, d) => acc + Math.max(0, diasDecorridos(d) - prazoEmDias(d)),
      0,
    );
    return soma / fora.length;
  }, [fora]);

  // Recorrência: reclamações
  const topReclamacoes = useMemo(() => {
    const m = new Map<string, number>();
    fora.forEach((d) => {
      const k = normalizarReclamacao(d.reclamacao) || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    const arr = Array.from(m.entries()).map(([label, count]) => ({
      label,
      count,
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 8);
  }, [fora]);

  // Recorrência: setores
  const topSetores = useMemo(() => {
    const m = new Map<string, number>();
    fora.forEach((d) => {
      const k = d.setor_responsavel || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    const arr = Array.from(m.entries()).map(([label, count]) => ({
      label,
      count,
    }));
    arr.sort((a, b) => b.count - a.count);
    return arr.slice(0, 8);
  }, [fora]);

  // Evolução mensal: % fora sobre total daquele mês
  const evolucao = useMemo(() => {
    const buckets = new Map<string, { fora: number; total: number; d: Date }>();
    filtered.forEach((d) => {
      const x = parseLocalDate(d.data_reclamacao);
      if (!x) return;
      const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
      const bucket =
        buckets.get(key) ?? { fora: 0, total: 0, d: new Date(x.getFullYear(), x.getMonth(), 1) };
      bucket.total += 1;
      if (isForaDoPrazo(d)) bucket.fora += 1;
      buckets.set(key, bucket);
    });
    const arr = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        label: mmYY(v.d),
        pct: v.total ? (v.fora / v.total) * 100 : 0,
      }));
    // Recharts não renderiza linha com 1 ponto
    if (arr.length === 1) return [{ label: " ", pct: arr[0].pct }, arr[0]];
    return arr;
  }, [filtered]);

  // Desempenho por executiva
  const porExecutiva = useMemo(() => {
    const map = new Map<string, { total: number; fora: number }>();
    filtered.forEach((d) => {
      const k = d.executiva || "—";
      const b = map.get(k) ?? { total: 0, fora: 0 };
      b.total += 1;
      if (isForaDoPrazo(d)) b.fora += 1;
      map.set(k, b);
    });
    return Array.from(map.entries())
      .map(([nome, v]) => ({
        nome,
        total: v.total,
        fora: v.fora,
        pct: v.total ? (v.fora / v.total) * 100 : 0,
      }))
      .filter((r) => r.fora > 0)
      .sort((a, b) => b.fora - a.fora);
  }, [filtered]);

  const limpar = () => {
    setDataIni(toISO(firstDayOfMonth()));
    setDataFim(toISO(lastDayOfMonth()));
    setEmpresa("__all__");
    setExecutiva("__all__");
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Devolutivas fora do prazo
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detalhamento das demandas que ultrapassaram o SLA do setor —
            análise de recorrência e evolução temporal.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/demandas/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao dashboard
          </Link>
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4 rounded-xl bg-card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Data inicial
            </label>
            <Input
              type="date"
              value={dataIni}
              onChange={(e) => setDataIni(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Data final
            </label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Empresa
            </label>
            <Select value={empresa} onValueChange={setEmpresa}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Executiva(o)
            </label>
            <Select value={executiva} onValueChange={setExecutiva}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {executivas.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" className="w-full" onClick={limpar}>
              Limpar filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Total fora do prazo"
          value={totalFora.toString()}
          hint="no período filtrado"
          variant={totalFora > 0 ? "danger" : "default"}
        />
        <KpiCard
          icon={<Percent className="h-5 w-5" />}
          label="% sobre o total"
          value={`${pctFora.toFixed(1)}%`}
          hint={`${totalFora} de ${total} demandas`}
          variant={acimaMeta ? "danger" : "success"}
        />
        <KpiCard
          icon={<Target className="h-5 w-5" />}
          label="Meta do setor"
          value={`${META_DEVOLUTIVAS_FORA_PRAZO}%`}
          hint={acimaMeta ? "Acima da meta" : "Dentro da meta"}
          variant={acimaMeta ? "danger" : "success"}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5" />}
          label="Média de dias de atraso"
          value={`${mediaAtraso.toFixed(1)}d`}
          hint="duração média"
        />
      </div>

      {/* Recorrência */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankingCard
          title="Reclamações mais frequentes"
          items={topReclamacoes}
        />
        <RankingCard
          title="Setores com mais devolutivas fora do prazo"
          items={topSetores}
        />
      </div>

      {/* Evolução mensal */}
      <Card className="p-5 rounded-xl bg-card">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Evolução mensal</h2>
          <p className="text-xs text-muted-foreground">
            % de devolutivas fora do prazo por mês
          </p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer>
            <LineChart
              data={evolucao}
              margin={{ top: 16, right: 48, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v) => `${v}%`}
              />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(v: number) => [`${v.toFixed(1)}%`, "Fora do prazo"]}
              />
              <ReferenceLine
                y={META_DEVOLUTIVAS_FORA_PRAZO}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
                label={{
                  value: `Meta ${META_DEVOLUTIVAS_FORA_PRAZO}%`,
                  position: "right",
                  fill: "hsl(var(--destructive))",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="pct"
                stroke="hsl(var(--destructive))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--destructive))" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Tabela das demandas fora do prazo */}
      <Card className="p-5 rounded-xl bg-card">
        <div className="mb-3">
          <h2 className="text-base font-semibold">
            Lista das demandas fora do prazo
          </h2>
          <p className="text-xs text-muted-foreground">
            Ordenadas do mais antigo para o mais recente
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Beneficiário</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Reclamação</TableHead>
                <TableHead>Executiva</TableHead>
                <TableHead className="text-right">Dias em aberto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fora.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    {isLoading
                      ? "Carregando..."
                      : "Nenhuma devolutiva fora do prazo no período."}
                  </TableCell>
                </TableRow>
              ) : (
                fora.map((d) => {
                  const dias = Math.round(diasDecorridos(d));
                  const resolvido = isResolved(d);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {formatDate(d.data_reclamacao)}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate"
                        title={d.nome_cliente || ""}
                      >
                        {d.nome_cliente || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[180px] truncate"
                        title={d.empresa || ""}
                      >
                        {d.empresa || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] truncate"
                        title={d.setor_responsavel || ""}
                      >
                        {d.setor_responsavel || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate"
                        title={d.reclamacao || ""}
                      >
                        {normalizarReclamacao(d.reclamacao) || "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] truncate"
                        title={d.executiva || ""}
                      >
                        {d.executiva || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive tabular-nums">
                          {dias}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {resolvido ? (
                          <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                            Resolvido
                          </Badge>
                        ) : (
                          <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15">
                            Em aberto
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Desempenho por executiva */}
      <Card className="p-5 rounded-xl bg-card">
        <div className="mb-3">
          <h2 className="text-base font-semibold">Desempenho por executiva</h2>
          <p className="text-xs text-muted-foreground">
            Apenas executivas com pelo menos uma devolutiva fora do prazo
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Executiva</TableHead>
                <TableHead className="text-right">Total fora do prazo</TableHead>
                <TableHead className="text-right">% sobre o total dela</TableHead>
                <TableHead className="w-[260px]">Severidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porExecutiva.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground py-12"
                  >
                    Nenhuma executiva com devolutivas fora do prazo.
                  </TableCell>
                </TableRow>
              ) : (
                porExecutiva.map((r) => (
                  <TableRow key={r.nome}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right tabular-nums text-destructive font-semibold">
                      {r.fora}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.pct.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, r.pct)}
                          className="h-2 flex-1"
                        />
                        <span
                          className={cn(
                            "text-xs tabular-nums w-12 text-right",
                            r.pct > META_DEVOLUTIVAS_FORA_PRAZO
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {r.pct.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   Componentes internos
============================================================ */
function KpiCard({
  icon,
  label,
  value,
  hint,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  variant?: "default" | "success" | "danger";
}) {
  const tone =
    variant === "danger"
      ? { bg: "bg-destructive/10", text: "text-destructive" }
      : variant === "success"
      ? { bg: "bg-primary/10", text: "text-primary" }
      : { bg: "bg-muted", text: "text-foreground" };
  return (
    <Card className="p-4 rounded-xl bg-card shadow-sm flex items-start gap-3">
      <div
        className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          tone.bg,
          tone.text,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-semibold tabular-nums", tone.text)}>
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
        )}
      </div>
    </Card>
  );
}

function RankingCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; count: number }[];
}) {
  const total = items.reduce((acc, i) => acc + i.count, 0);
  const max = items[0]?.count ?? 0;
  return (
    <Card className="p-5 rounded-xl bg-card shadow-sm">
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sem dados no período.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const pct = total ? (it.count / total) * 100 : 0;
            const barPct = max ? (it.count / max) * 100 : 0;
            return (
              <li key={it.label}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span
                    className="text-sm truncate"
                    title={it.label}
                  >
                    {it.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {it.count} ocorrências · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-destructive rounded-full transition-all"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
