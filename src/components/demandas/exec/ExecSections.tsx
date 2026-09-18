import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
        <TooltipContent className="max-w-xs text-xs leading-relaxed">{children}</TooltipContent>
      </UiTooltip>
    </TooltipProvider>
  );
}

function Delta({ pct, inverse }: { pct: number | null | undefined; inverse?: boolean }) {
  if (typeof pct !== "number" || Number.isNaN(pct)) {
    return <span className="text-[11px] text-muted-foreground">sem base comparativa</span>;
  }
  const up = pct > 0;
  const flat = pct === 0;
  const positive = inverse ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[11px] font-semibold",
        flat ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}% vs. período anterior
    </span>
  );
}

/* ============================================================
   1. Resumo executivo
============================================================ */
export function ResumoExecutivo({
  texto,
  destaques,
}: {
  texto: string;
  destaques: { label: string; value: string; hint?: string }[];
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <div className="border-b border-border/60 bg-muted/30 px-5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Resumo executivo
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/90">{texto}</p>
      </div>
      <div className="grid grid-cols-1 divide-y divide-border/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {destaques.map((d) => (
          <div key={d.label} className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{d.label}</p>
            <p className="mt-1 truncate text-base font-semibold text-foreground">{d.value}</p>
            {d.hint && <p className="text-[11px] text-muted-foreground">{d.hint}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ============================================================
   2. KPI executivo
============================================================ */
export function KpiExecutivo({
  label,
  value,
  deltaPct,
  deltaInverse,
  descricao,
  status,
  tone = "neutral",
  metodologia,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  deltaInverse?: boolean;
  descricao?: string;
  status?: string;
  tone?: ExecTone;
  metodologia?: string;
}) {
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
      <Delta pct={deltaPct} inverse={deltaInverse} />
      {descricao && <p className="text-[11px] leading-snug text-muted-foreground">{descricao}</p>}
    </Card>
  );
}

/* ============================================================
   3. Concentração de demandas
============================================================ */
export function ConcentracaoDemandas({
  data,
  total,
}: {
  data: { setor: string; n: number; pct: number }[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const principal = data[0];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <Card className="border-border/70 p-5 shadow-sm">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
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
                <span className="col-span-3 text-right text-sm tabular-nums text-muted-foreground">{d.pct}%</span>
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
              {principal.pct}% do volume total ({total} demandas no período)
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   4. Mapa de pressão operacional
============================================================ */
export type SetorAgg = {
  setor: string;
  volume: number;
  pctVolume: number;
  slaPct: number;
  foraPct: number;
  backlog: number;
  tempoMedio: number;
  recorrenciaPct: number;
  clientesRecorrentes: number;
  clientesTotal: number;
  impacto: number;
  classificacao: "ESTÁVEL" | "MONITORAR" | "ATENÇÃO" | "CRÍTICO" | null;
  motivos: string[];
  volumeAlto: boolean;
};

const CLASSIF_TONE: Record<string, ExecTone> = {
  "ESTÁVEL": "success",
  MONITORAR: "info",
  "ATENÇÃO": "warning",
  "CRÍTICO": "danger",
};

export function MapaPressao({ rows }: { rows: SetorAgg[] }) {
  const quadrantes = [
    { titulo: "Volume alto · impacto alto", filtro: (r: SetorAgg) => r.volumeAlto && r.impacto >= 50 },
    { titulo: "Volume baixo · impacto alto", filtro: (r: SetorAgg) => !r.volumeAlto && r.impacto >= 50 },
    { titulo: "Volume alto · impacto controlado", filtro: (r: SetorAgg) => r.volumeAlto && r.impacto < 50 },
    { titulo: "Volume baixo · impacto controlado", filtro: (r: SetorAgg) => !r.volumeAlto && r.impacto < 50 },
  ];
  const classificados = rows.filter((r) => r.classificacao);
  const semDados = rows.filter((r) => !r.classificacao);

  return (
    <Card className="border-border/70 p-5 shadow-sm">
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
                          <StatusPill
                            label={r.classificacao!}
                            tone={CLASSIF_TONE[r.classificacao!] ?? "neutral"}
                          />
                        </div>
                        <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                          {r.volume} demandas · SLA {r.slaPct}% · backlog {r.backlog} · {r.tempoMedio.toFixed(1)}d
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
   5. Pontos de atenção
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
   6. Recorrência por setor
============================================================ */
export function RecorrenciaSetor({ rows }: { rows: SetorAgg[] }) {
  const badge = (taxa: number): { label: string; tone: ExecTone } =>
    taxa >= 30 ? { label: "Alta", tone: "warning" } : taxa >= 15 ? { label: "Moderada", tone: "info" } : { label: "Baixa", tone: "success" };
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
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
   7. Gargalos operacionais
============================================================ */
export function GargalosTabela({
  rows,
}: {
  rows: { setor: string; tipo: string; qtd: number; tempoMedio: number; foraPct: number }[];
}) {
  const impacto = (foraPct: number): { label: string; tone: ExecTone } =>
    foraPct >= 40 ? { label: "Alto", tone: "danger" } : foraPct >= 15 ? { label: "Médio", tone: "warning" } : { label: "Baixo", tone: "success" };
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Setor</th>
                <th className="px-4 py-2.5 text-left font-semibold">Tipo de demanda</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tempo médio</th>
                <th className="px-4 py-2.5 text-right font-semibold">Impacto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const imp = impacto(r.foraPct);
                return (
                  <tr key={`${r.setor}-${r.tipo}`} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2.5 text-foreground/90">{r.setor}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.tipo}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.qtd}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.tempoMedio.toFixed(1)}d</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:inline-block">
                          <span
                            className={cn("block h-full rounded-full", execTone[imp.tone].dot)}
                            style={{ width: `${Math.min(100, r.foraPct)}%` }}
                          />
                        </span>
                        <StatusPill label={imp.label} tone={imp.tone} />
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
   8. Prioridades de atuação
============================================================ */
export function PrioridadesAtuacao({
  itens,
}: {
  itens: { setor: string; motivo: string; indicadores: string; tone: ExecTone }[];
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
              <StatusPill label={i.tone === "danger" ? "Crítico" : i.tone === "warning" ? "Atenção" : "Monitorar"} tone={i.tone} />
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
   9. Visão comparativa dos setores
============================================================ */
export function VisaoComparativaSetores({ rows }: { rows: SetorAgg[] }) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      {rows.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">Setor</th>
                <th className="px-4 py-2.5 text-right font-semibold">Volume</th>
                <th className="px-4 py-2.5 text-right font-semibold">SLA</th>
                <th className="px-4 py-2.5 text-right font-semibold">Backlog</th>
                <th className="px-4 py-2.5 text-right font-semibold">Tempo médio</th>
                <th className="px-4 py-2.5 text-right font-semibold">Recorrência</th>
                <th className="px-4 py-2.5 text-right font-semibold">Classificação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.setor} className="border-b border-border/40 last:border-0">
                  <td className="px-4 py-2.5 text-foreground/90">{r.setor}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.volume} <span className="text-[11px] text-muted-foreground">({r.pctVolume}%)</span>
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
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.tempoMedio.toFixed(1)}d</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{r.recorrenciaPct}%</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.classificacao ? (
                      <StatusPill label={r.classificacao} tone={CLASSIF_TONE[r.classificacao] ?? "neutral"} />
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
    </Card>
  );
}
