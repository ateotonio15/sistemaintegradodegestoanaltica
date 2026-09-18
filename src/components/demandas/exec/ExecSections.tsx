import { ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ============================================================
   Tokens de status executivo
============================================================ */
export type ExecTone = "neutral" | "info" | "success" | "warning" | "danger";

export const execTone: Record<ExecTone, { text: string; bg: string; dot: string; ring: string }> = {
  neutral: { text: "text-muted-foreground", bg: "bg-muted", dot: "bg-muted-foreground", ring: "ring-border" },
  info: { text: "text-info", bg: "bg-info/10", dot: "bg-info", ring: "ring-info/20" },
  success: { text: "text-success", bg: "bg-success/10", dot: "bg-success", ring: "ring-success/20" },
  warning: { text: "text-warning", bg: "bg-warning/10", dot: "bg-warning", ring: "ring-warning/20" },
  danger: { text: "text-destructive", bg: "bg-destructive/10", dot: "bg-destructive", ring: "ring-destructive/20" },
};

export const fmt1 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: ExecTone }) {
  const t = execTone[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        t.bg,
        t.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {label}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>
        )}
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function InfoHint({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <UiTooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Metodologia do indicador"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted-foreground"
          >
            i
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line text-xs leading-relaxed">{children}</TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  );
}

/* ============================================================
   Insights automáticos (topo)
============================================================ */
export type Insight = { categoria: string; texto: string; tone: ExecTone };

export function InsightsExecutivos({ itens }: { itens: Insight[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {itens.map((i, idx) => (
        <Card key={i.categoria + idx} className="flex items-start gap-3 border-border/70 p-4 shadow-sm">
          <span className="text-sm font-semibold tabular-nums text-muted-foreground/60">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider", execTone[i.tone].text)}>
              {i.categoria}
            </p>
            <p className="mt-0.5 text-xs leading-snug text-foreground/90">{i.texto}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
   Resumo executivo
============================================================ */
export function ResumoExecutivo({
  periodoLabel,
  blocos,
}: {
  periodoLabel: string;
  blocos: { label: string; value: string; hint?: string }[];
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Resumo executivo</p>
        <p className="text-[11px] text-muted-foreground">{periodoLabel}</p>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {blocos.map((d) => (
          <div key={d.label} className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</p>
            <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{d.value}</p>
            {d.hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{d.hint}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   KPI executivo com contexto
============================================================ */
export function KpiExecutivo({
  label,
  value,
  descricao,
  comparacao,
  meta,
  status,
  tone = "neutral",
  metodologia,
}: {
  label: string;
  value: string;
  descricao?: string;
  /** valor anterior + variação absoluta/percentual já formatados */
  comparacao?: { anteriorLabel: string; anteriorValor: string; variacao: string; direcao: "up" | "down" | "flat" } | null;
  meta?: { texto: string; diferenca?: string };
  status?: string;
  tone?: ExecTone;
  metodologia?: string;
}) {
  const Icon = comparacao?.direcao === "flat" ? Minus : comparacao?.direcao === "up" ? ArrowUp : ArrowDown;
  return (
    <Card className="flex flex-col gap-2 border-border/70 p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
          {metodologia && <InfoHint>{metodologia}</InfoHint>}
        </p>
        {status && <StatusPill label={status} tone={tone} />}
      </div>
      <p className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">{value}</p>
      {descricao && <p className="text-[11px] leading-snug text-muted-foreground">{descricao}</p>}
      {comparacao ? (
        <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <Icon className="h-3 w-3" />
          <span className="font-semibold text-foreground/90">{comparacao.variacao}</span>
          <span>
            · {comparacao.anteriorLabel}: {comparacao.anteriorValor}
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">Sem base comparativa no período anterior</p>
      )}
      {meta && (
        <p className="text-[11px] text-muted-foreground">
          {meta.texto}
          {meta.diferenca && <span className="ml-1 font-semibold text-foreground/90">({meta.diferenca})</span>}
        </p>
      )}
    </Card>
  );
}

/* ============================================================
   Concentração de demandas
============================================================ */
export function ConcentracaoDemandas({
  data,
  total,
}: {
  data: { setor: string; n: number; pct: number; pctExato: number }[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const principal = data[0];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <Card className="border-border/70 p-5 shadow-sm">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma demanda encontrada para os filtros selecionados.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-12 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="col-span-6">Setor</span>
              <span className="col-span-3 text-right">Quantidade</span>
              <span className="col-span-3 text-right">% do total</span>
            </div>
            {data.map((d) => (
              <div key={d.setor} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-6 truncate text-sm text-foreground/90">{d.setor}</span>
                <span className="col-span-3 text-right text-sm font-semibold tabular-nums">{d.n}</span>
                <span
                  className="col-span-3 cursor-help text-right text-sm tabular-nums text-muted-foreground"
                  title={`${fmt1(d.pctExato)}% de ${total} demandas`}
                >
                  {d.pct}%
                </span>
                <div className="col-span-12 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(d.n / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="flex flex-col justify-center gap-1 border-border/70 bg-muted/20 p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Principal concentração
        </p>
        {principal ? (
          <>
            <p className="text-lg font-semibold leading-tight text-foreground">{principal.setor}</p>
            <p className="text-3xl font-semibold tabular-nums text-foreground">{principal.n}</p>
            <p className="text-xs text-muted-foreground">
              {fmt1(principal.pctExato)}% do volume total ({total} demandas no período)
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma demanda encontrada para os filtros selecionados.</p>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   Mapa de pressão operacional
============================================================ */
export type Pressao = "BAIXA" | "MODERADA" | "ALTA" | "CRÍTICA";

export type SetorAgg = {
  setor: string;
  volume: number;
  pctVolume: number;
  pctVolumeExato: number;
  slaPct: number;
  foraPct: number;
  backlog: number;
  backlogPct: number;
  tempoMedio: number;
  prazoDias: number;
  recorrenciaPct: number;
  clientesRecorrentes: number;
  clientesTotal: number;
  pressaoScore: number;
  pressao: Pressao | null;
  motivos: string[];
  volumeAlto: boolean;
};

export const PRESSAO_TONE: Record<Pressao, ExecTone> = {
  BAIXA: "success",
  MODERADA: "info",
  ALTA: "warning",
  "CRÍTICA": "danger",
};

const METODOLOGIA_PRESSAO = `Índice de pressão (0 a 100) calculado a partir dos indicadores disponíveis do setor no período filtrado:

• Devolutivas fora do prazo — peso 40%
• Backlog proporcional ao volume — peso 30%
• Tempo médio frente ao prazo do setor (72h, ou 168h na Agenda Cirúrgica) — peso 20%
• Taxa de recorrência de clientes — peso 10%

Faixas: até 20 = Baixa · 20 a 39 = Moderada · 40 a 59 = Alta · 60 ou mais = Crítica.
Setores com menos de 3 demandas no período não são classificados.
Volume alto, isoladamente, não eleva a classificação.`;

export function MetodologiaPressaoButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
        Como é calculado?
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Classificação de pressão operacional</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{METODOLOGIA_PRESSAO}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MapaPressao({ rows }: { rows: SetorAgg[] }) {
  const quadrantes = [
    { titulo: "Volume alto · pressão elevada", filtro: (r: SetorAgg) => r.volumeAlto && r.pressaoScore >= 40 },
    { titulo: "Volume baixo · pressão elevada", filtro: (r: SetorAgg) => !r.volumeAlto && r.pressaoScore >= 40 },
    { titulo: "Volume alto · pressão controlada", filtro: (r: SetorAgg) => r.volumeAlto && r.pressaoScore < 40 },
    { titulo: "Volume baixo · pressão controlada", filtro: (r: SetorAgg) => !r.volumeAlto && r.pressaoScore < 40 },
  ];
  const classificados = rows.filter((r) => r.pressao);
  const semDados = rows.filter((r) => !r.pressao);

  return (
    <Card className="border-border/70 p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Classificação calculada a partir dos indicadores disponíveis.
          <InfoHint>{METODOLOGIA_PRESSAO}</InfoHint>
        </p>
        <MetodologiaPressaoButton />
      </div>
      {classificados.length === 0 ? (
        <p className="text-sm text-muted-foreground">Dados insuficientes para classificação.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {quadrantes.map((q) => {
            const itens = classificados.filter(q.filtro);
            return (
              <div key={q.titulo} className="rounded-xl border border-border/60 bg-muted/15 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{q.titulo}</p>
                <div className="mt-3 space-y-2.5">
                  {itens.length === 0 ? (
                    <p className="text-xs text-muted-foreground/80">Nenhum setor nesta faixa.</p>
                  ) : (
                    itens.map((r) => (
                      <div key={r.setor} className="rounded-lg bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-foreground">{r.setor}</p>
                          <StatusPill label={r.pressao!} tone={PRESSAO_TONE[r.pressao!]} />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                          {r.volume} demandas · SLA {r.slaPct}% · backlog {r.backlog} · {fmt1(r.tempoMedio)}d ·
                          recorrência {r.recorrenciaPct}% · índice {r.pressaoScore}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {semDados.length > 0 && (
        <p className="mt-4 text-[11px] text-muted-foreground">
          Dados insuficientes para classificação: {semDados.map((r) => r.setor).join(", ")} (menos de 3 demandas no
          período).
        </p>
      )}
    </Card>
  );
}

/* ============================================================
   Pontos de atenção
============================================================ */
export function PontosAtencao({
  itens,
}: {
  itens: { titulo: string; valor: string; detalhe: string; tone: ExecTone; href?: string; linkLabel?: string }[];
}) {
  if (itens.length === 0) {
    return (
      <Card className="border-border/70 p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Nenhum ponto de atenção identificado a partir dos dados do período.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {itens.map((i) => {
        const t = execTone[i.tone];
        return (
          <Card key={i.titulo + i.valor} className="flex flex-col gap-1.5 border-border/70 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{i.titulo}</p>
              <span className={cn("h-2 w-2 shrink-0 rounded-full", t.dot)} />
            </div>
            <p className={cn("text-xl font-semibold tabular-nums", t.text)}>{i.valor}</p>
            <p className="text-[11px] leading-snug text-muted-foreground">{i.detalhe}</p>
            {i.href && (
              <Link to={i.href} className="mt-1 text-[11px] font-semibold text-primary hover:underline">
                {i.linkLabel ?? "Ver detalhes"} →
              </Link>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   Recorrência por setor
============================================================ */
export function RecorrenciaSetor({ rows }: { rows: SetorAgg[] }) {
  const badge = (taxa: number): { label: string; tone: ExecTone } =>
    taxa >= 30
      ? { label: "Alta", tone: "warning" }
      : taxa >= 15
      ? { label: "Moderada", tone: "info" }
      : { label: "Baixa", tone: "success" };
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nenhuma demanda encontrada para os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Setor</th>
                <th className="px-4 py-2.5 text-right font-semibold">Clientes recorrentes</th>
                <th className="px-4 py-2.5 text-right font-semibold">Total de clientes</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Taxa de recorrência
                    <InfoHint>
                      Percentual de clientes que apresentaram mais de uma demanda no mesmo setor durante o período
                      analisado.
                    </InfoHint>
                  </span>
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const b = badge(r.recorrenciaPct);
                return (
                  <tr key={r.setor} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-foreground/90">{r.setor}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.clientesRecorrentes}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.clientesTotal}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.recorrenciaPct}%</td>
                    <td className="px-4 py-2.5 text-right">
                      <StatusPill label={b.label} tone={b.tone} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   Gargalos operacionais
============================================================ */
export type GargaloRow = {
  setor: string;
  tipo: string;
  qtd: number;
  tempoMedio: number;
  foraPct: number;
  impacto: number;
};

export function GargalosTabela({ rows }: { rows: GargaloRow[] }) {
  const faixa = (impacto: number): { label: string; tone: ExecTone } =>
    impacto >= 60
      ? { label: "Alto", tone: "danger" }
      : impacto >= 35
      ? { label: "Médio", tone: "warning" }
      : { label: "Baixo", tone: "success" };
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nenhuma demanda encontrada para os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Setor</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tipo de demanda</th>
                <th className="px-4 py-2.5 text-right font-semibold">Quantidade</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tempo médio</th>
                <th className="px-4 py-2.5 text-right font-semibold">Fora do prazo</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Impacto
                    <InfoHint>
                      Índice de 0 a 100 que combina percentual fora do prazo (45%), tempo médio frente ao prazo do
                      setor (35%) e participação no volume do período (20%).
                    </InfoHint>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const imp = faixa(r.impacto);
                return (
                  <tr key={`${r.setor}-${r.tipo}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-foreground/90">{r.setor}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.tipo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.qtd}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt1(r.tempoMedio)}d</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.foraPct}%</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block">
                          <span
                            className={cn("block h-full rounded-full", execTone[imp.tone].dot)}
                            style={{ width: `${Math.min(100, r.impacto)}%` }}
                          />
                        </span>
                        <StatusPill label={`${imp.label} · ${r.impacto}`} tone={imp.tone} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   Prioridades de atuação
============================================================ */
export function PrioridadesAtuacao({
  itens,
}: {
  itens: { setor: string; motivo: string; indicadores: string; tone: ExecTone; status: string }[];
}) {
  if (itens.length === 0) {
    return (
      <Card className="border-border/70 p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Nenhuma prioridade destacada com os dados do período selecionado.
        </p>
      </Card>
    );
  }
  return (
    <Card className="divide-y divide-border/50 border-border/70 shadow-sm">
      {itens.map((i, idx) => (
        <div key={i.setor} className="flex items-start gap-4 px-5 py-4">
          <span className="text-lg font-semibold tabular-nums text-muted-foreground/60">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{i.setor}</p>
              <StatusPill label={i.status} tone={i.tone} />
            </div>
            <p className="mt-0.5 text-xs text-foreground/80">{i.motivo}</p>
            <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{i.indicadores}</p>
          </div>
        </div>
      ))}
    </Card>
  );
}

/* ============================================================
   Visão comparativa dos setores (ordenável + drill-down)
============================================================ */
type SortKey = "volume" | "slaPct" | "backlog" | "tempoMedio" | "recorrenciaPct" | "pressaoScore";

export function VisaoComparativaSetores({
  rows,
  onSelect,
}: {
  rows: SetorAgg[];
  onSelect?: (setor: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("pressaoScore");
  const [asc, setAsc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const diff = (a[sortKey] as number) - (b[sortKey] as number);
    return asc ? diff : -diff;
  });

  const th = (label: string, key: SortKey) => (
    <th className="px-4 py-2.5 text-right font-semibold">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => {
          if (sortKey === key) setAsc(!asc);
          else {
            setSortKey(key);
            setAsc(false);
          }
        }}
        aria-label={`Ordenar por ${label}`}
      >
        {label}
        {sortKey === key ? (
          asc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : null}
      </button>
    </th>
  );

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nenhuma demanda encontrada para os filtros selecionados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Setor</th>
                {th("Demandas", "volume")}
                <th className="px-4 py-2.5 text-right font-semibold">% do total</th>
                {th("SLA", "slaPct")}
                {th("Backlog", "backlog")}
                {th("Tempo médio", "tempoMedio")}
                {th("Recorrência", "recorrenciaPct")}
                {th("Status", "pressaoScore")}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.setor}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    onSelect && "cursor-pointer transition-colors hover:bg-muted/30",
                  )}
                  onClick={onSelect ? () => onSelect(r.setor) : undefined}
                >
                  <td className="px-4 py-2.5 font-medium text-foreground/90">{r.setor}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.volume}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground" title={`${fmt1(r.pctVolumeExato)}%`}>
                    {r.pctVolume}%
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right font-semibold tabular-nums",
                      r.slaPct >= 90 ? "text-success" : r.slaPct >= 75 ? "text-warning" : "text-destructive",
                    )}
                  >
                    {r.slaPct}%
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.backlog}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt1(r.tempoMedio)}d</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.recorrenciaPct}%</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.pressao ? (
                      <StatusPill label={r.pressao} tone={PRESSAO_TONE[r.pressao]} />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Dados insuficientes</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {onSelect && rows.length > 0 && (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          Clique em um setor para abrir o detalhamento.
        </p>
      )}
    </Card>
  );
}
