import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmt1, PRESSAO_TONE, StatusPill, type SetorAgg } from "./ExecSections";

export type SetorDetalhe = {
  agg: SetorAgg;
  evolucao: { label: string; volume: number; sla: number; backlog: number; tempoMedio: number }[];
  tipos: { tipo: string; n: number; pct: number }[];
  gargalos: { tipo: string; qtd: number; tempoMedio: number; foraPct: number }[];
  atrasadas: { cliente: string; empresa: string; tipo: string; dias: number; abertura: string }[];
};

function Bloco({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SubTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</h4>
  );
}

export function SetorDrilldown({
  detalhe,
  periodoLabel,
  onClose,
}: {
  detalhe: SetorDetalhe | null;
  periodoLabel: string;
  onClose: () => void;
}) {
  const open = !!detalhe;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {detalhe && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {detalhe.agg.setor}
                {detalhe.agg.pressao && (
                  <StatusPill label={detalhe.agg.pressao} tone={PRESSAO_TONE[detalhe.agg.pressao]} />
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{periodoLabel}</p>
            </DialogHeader>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Bloco label="Demandas" value={String(detalhe.agg.volume)} hint={`${detalhe.agg.pctVolume}% do total`} />
                <Bloco label="SLA" value={`${detalhe.agg.slaPct}%`} hint={`${detalhe.agg.foraPct}% fora do prazo`} />
                <Bloco label="Backlog" value={String(detalhe.agg.backlog)} hint={`${detalhe.agg.backlogPct}% do setor`} />
                <Bloco
                  label="Tempo médio"
                  value={`${fmt1(detalhe.agg.tempoMedio)}d`}
                  hint={`Prazo: ${detalhe.agg.prazoDias}d`}
                />
                <Bloco
                  label="Recorrência"
                  value={`${detalhe.agg.recorrenciaPct}%`}
                  hint={`${detalhe.agg.clientesRecorrentes} de ${detalhe.agg.clientesTotal} clientes`}
                />
              </div>

              <section className="space-y-2">
                <SubTitulo>Evolução do setor</SubTitulo>
                {detalhe.evolucao.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados para o período selecionado.</p>
                ) : (
                  <Card className="overflow-hidden border-border/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 text-left font-semibold">Mês</th>
                          <th className="px-3 py-2 text-right font-semibold">Demandas</th>
                          <th className="px-3 py-2 text-right font-semibold">SLA</th>
                          <th className="px-3 py-2 text-right font-semibold">Backlog</th>
                          <th className="px-3 py-2 text-right font-semibold">Tempo médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhe.evolucao.map((m) => (
                          <tr key={m.label} className="border-b border-border/30 last:border-0">
                            <td className="px-3 py-2 capitalize text-foreground/90">{m.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.volume}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.sla}%</td>
                            <td className="px-3 py-2 text-right tabular-nums">{m.backlog}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmt1(m.tempoMedio)}d</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </section>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <section className="space-y-2">
                  <SubTitulo>Tipos de demanda</SubTitulo>
                  {detalhe.tipos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="space-y-2">
                      {detalhe.tipos.map((t) => (
                        <div key={t.tipo}>
                          <div className="flex justify-between text-xs">
                            <span className="truncate text-foreground/90">{t.tipo}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {t.n} · {t.pct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${t.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-2">
                  <SubTitulo>Principais gargalos</SubTitulo>
                  {detalhe.gargalos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem gargalos identificados no período.</p>
                  ) : (
                    <div className="space-y-2">
                      {detalhe.gargalos.map((g) => (
                        <div
                          key={g.tipo}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                        >
                          <span className="truncate text-xs text-foreground/90">{g.tipo}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {g.qtd} · {fmt1(g.tempoMedio)}d · {g.foraPct}% fora
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="space-y-2">
                <SubTitulo>Demandas em atraso</SubTitulo>
                {detalhe.atrasadas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma demanda em atraso no período.</p>
                ) : (
                  <Card className="overflow-hidden border-border/60">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/25 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                          <th className="px-3 py-2 text-left font-semibold">Empresa</th>
                          <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                          <th className="px-3 py-2 text-right font-semibold">Abertura</th>
                          <th className="px-3 py-2 text-right font-semibold">Dias</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhe.atrasadas.map((d, i) => (
                          <tr key={`${d.cliente}-${i}`} className="border-b border-border/30 last:border-0">
                            <td className="px-3 py-2 text-foreground/90">{d.cliente}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.empresa}</td>
                            <td className="px-3 py-2 text-muted-foreground">{d.tipo}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{d.abertura}</td>
                            <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", d.dias > 15 && "text-destructive")}>
                              {d.dias}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </section>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
