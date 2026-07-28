import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Building2, FileText, Users, Wallet, CalendarClock, AlertTriangle, CheckCircle2, Clock, Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChatAtendimento } from "@/components/portal/ChatAtendimento";
import { contratoDentroDoPeriodo, calcularStatus, statusColor, formatMesReferencia } from "@/lib/movimentacao-utils";
import { cn } from "@/lib/utils";

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "-";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  try { return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR }); } catch { return v; }
}

export default function MeuPainel() {
  const { user, activeEmpresaId, setActiveEmpresaId, isCorretora, corretoraNome, corretoraEmpresas, corretoraPortalSecoes, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const { data: empresa } = useQuery({
    queryKey: ["meu-painel", "empresa", activeEmpresaId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, status_empresa, portal_secoes, tipo_movimentacao, periodo_movimentacao, data_implantacao, data_corte, dia_movimentacao, prazo, responsavel_contrato, executiva_user_id, valor_enfermaria_centavos, valor_apartamento_centavos, vidas")
        .eq("id", activeEmpresaId!)
        .maybeSingle();
      if (error) throw error;
      let executivaNome: string | null = null;
      if ((data as any)?.executiva_user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", (data as any).executiva_user_id)
          .maybeSingle();
        executivaNome = (prof as any)?.display_name ?? null;
      }
      return { ...(data as any), executiva_nome: executivaNome };
    },
  });

  const secoes = ((empresa as any)?.portal_secoes ?? {
    contrato: true, vidas: true, movimentacoes: true, chat: true,
  }) as Record<string, boolean>;

  const { data: contrato } = useQuery({
    queryKey: ["meu-painel", "contrato", activeEmpresaId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("valor_mensal, data_inicio, data_fim, status")
        .eq("empresa_id", activeEmpresaId!)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vidasAtivas } = useQuery({
    queryKey: ["meu-painel", "vidas", activeEmpresaId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vidas_ativas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", activeEmpresaId!)
        .eq("status", "ativo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: movsContrato } = useQuery({
    queryKey: ["meu-painel", "movs-contrato", activeEmpresaId, "v2-2026-05"],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, mes_referencia, periodo, data_envio_empresa, data_envio_financeiro, created_at")
        .eq("empresa_id", activeEmpresaId!)
        .gte("mes_referencia", "2026-05")
        .order("mes_referencia", { ascending: false })
        .order("periodo", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notasFinanceiro } = useQuery({
    queryKey: ["meu-painel", "notas-financeiro", activeEmpresaId],
    enabled: !!activeEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("mes_referencia, periodo, data_envio_nota")
        .eq("empresa_id", activeEmpresaId!)
        .not("data_envio_nota", "is", null);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((f: any) => {
        map.set(`${f.mes_referencia}__${f.periodo}`, f.data_envio_nota);
      });
      return map;
    },
  });



  const empresaNome = (empresa as any)?.nome ?? "Meu Painel";
  const initials = (name?: string | null) =>
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "—";

  const statusEmpresa = String((empresa as any)?.status_empresa ?? "").toLowerCase();
  const isAtivo = statusEmpresa === "ativa" || statusEmpresa === "ativo";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/40 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3 md:py-4">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <Building2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <div className="absolute inset-0 -z-10 blur-xl bg-primary/30 rounded-full" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-tight text-sm md:text-base truncate">{empresaNome}</div>
              <div className="text-[11px] md:text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme} title={theme === "dark" ? "Modo claro" : "Modo escuro"}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="px-2 md:px-3">
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-5 md:gap-8 px-4 py-5 md:py-10 animate-fade-in">
        {/* Hero header */}
        <section className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 md:gap-3">
          <div className="min-w-0">
            <p className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-1.5">
              Portal do Cliente
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight break-words">{empresaNome}</h1>
          </div>
          {(empresa as any)?.cnpj && (
            <div className="text-xs md:text-sm text-muted-foreground">
              CNPJ: <span className="text-foreground font-mono">{(empresa as any).cnpj}</span>
            </div>
          )}
        </section>


        {/* KPIs */}
        {(secoes.vidas || secoes.contrato) && (
          <div className="grid gap-3 md:gap-6 sm:grid-cols-2 md:grid-cols-3">
            {secoes.vidas && (
              <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6 transition-colors hover:border-primary/40">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2">Vidas ativas</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="text-3xl md:text-4xl font-bold tracking-tight">
                    {(empresa as any)?.vidas ?? "—"}
                  </h3>
                  <span className="text-[10px] md:text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    beneficiários
                  </span>
                </div>
              </div>
            )}

            {secoes.contrato && (
              <>
                <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6 transition-colors hover:border-primary/40">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                  <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2">Valor mensal de Enfermaria</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <h3 className="text-2xl md:text-4xl font-bold tracking-tight">
                      {fmtMoney(((empresa as any)?.valor_enfermaria_centavos ?? 0) / 100)}
                    </h3>
                    <span className="text-muted-foreground text-xs md:text-sm font-medium">/mês</span>
                  </div>
                </div>

                <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6 transition-colors hover:border-primary/40 sm:col-span-2 md:col-span-1">
                  <p className="text-xs md:text-sm font-medium text-muted-foreground mb-1.5 md:mb-2">Status do contrato</p>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full shrink-0",
                      isAtivo
                        ? "bg-primary shadow-[0_0_12px_hsl(var(--primary))] animate-pulse"
                        : "bg-muted-foreground",
                    )} />
                    <h3 className="text-xl md:text-2xl font-semibold tracking-tight uppercase truncate">
                      {(empresa as any)?.status_empresa ?? "—"}
                    </h3>
                  </div>
                  <p className="mt-2 md:mt-3 text-[11px] md:text-xs text-muted-foreground">
                    Vigência: {fmtDate(contrato?.data_inicio)} → {fmtDate(contrato?.data_fim) === "-" ? "sem prazo" : fmtDate(contrato?.data_fim)}
                  </p>
                </div>
              </>
            )}
          </div>
        )}


        {/* Two-column layout */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          {/* Left column: Resumo + Movimentações */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {secoes.contrato && (
              <section className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border flex justify-between items-center">
                  <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Resumo do contrato
                  </h2>
                </div>
                <div className="p-4 md:p-6 grid grid-cols-2 md:grid-cols-3 gap-y-4 md:gap-y-6 gap-x-4 md:gap-x-8">

                  <Info label="Empresa" value={empresaNome} />
                  <Info label="CNPJ" value={(empresa as any)?.cnpj ?? "—"} />
                  <Info label="Status" value={(empresa as any)?.status_empresa ?? "—"} />
                  <Info
                    label="Valor mensal de Enfermaria"
                    value={fmtMoney(((empresa as any)?.valor_enfermaria_centavos ?? 0) / 100)}
                  />
                  <Info
                    label="Valor mensal de Apartamento"
                    value={fmtMoney(
                      Number(contrato?.valor_mensal ?? 0) > 0
                        ? Number(contrato!.valor_mensal)
                        : ((empresa as any)?.valor_apartamento_centavos ?? 0) / 100
                    )}
                  />
                  <Info label="Tipo de Movimentação" value={(empresa as any)?.tipo_movimentacao ?? "—"} />
                  <Info
                    label="Início da vigência"
                    value={(() => {
                      const emp: any = empresa;
                      if (!emp) return "—";
                      let dia: number | null = null;
                      if (emp.periodo_movimentacao) {
                        dia = Number(emp.periodo_movimentacao.split("-")[0]);
                      } else if (emp.data_corte) {
                        const d = Number(emp.data_corte);
                        dia = d <= 5 ? 1 : d <= 10 ? 5 : d <= 15 ? 10 : d <= 20 ? 15 : d <= 25 ? 20 : 25;
                      }
                      if (!dia) return "—";
                      const now = new Date();
                      return `${String(dia).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
                    })()}
                  />
                  <Info
                    label="Fim da vigência"
                    value={(() => {
                      const emp: any = empresa;
                      if (!emp) return "—";
                      let dia: number | null = null;
                      if (emp.periodo_movimentacao) {
                        dia = Number(emp.periodo_movimentacao.split("-")[1]);
                      } else if (emp.data_corte) {
                        dia = Number(emp.data_corte);
                      }
                      if (!dia) return "—";
                      const now = new Date();
                      return `${String(dia).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
                    })()}
                  />
                  <Info
                    label="Período de Movimentação"
                    value={
                      (empresa as any)?.tipo_movimentacao === "Diária"
                        ? `Diária (corte dia ${(empresa as any)?.data_corte ? fmtDate((empresa as any).data_corte) : "—"})`
                        : ((empresa as any)?.periodo_movimentacao ?? "—")
                    }
                  />
                  <Info label="Data de Implantação" value={fmtDate((empresa as any)?.data_implantacao)} />
                  <Info label="Prazo (sem carência)" value={(empresa as any)?.prazo ?? "—"} />
                </div>
              </section>
            )}

            {secoes.movimentacoes && (() => {
              const noPeriodo = empresa ? contratoDentroDoPeriodo(empresa as any) : false;
              return (
                <section className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border">
                    <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-primary" />
                      Movimentações do contrato
                    </h2>
                    <p className="text-[11px] md:text-xs text-muted-foreground mt-1">Envios do cadastro e do financeiro, por competência.</p>
                  </div>

                  {noPeriodo && (
                    <div className="mx-4 md:mx-6 mt-3 md:mt-4 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                      <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">Contrato dentro do período de movimentação</p>
                        <p className="text-muted-foreground text-xs">
                          Este contrato está no período{" "}
                          <strong>
                            {(empresa as any)?.tipo_movimentacao === "Diária"
                              ? `corte dia ${(empresa as any)?.data_corte ?? "—"}`
                              : (empresa as any)?.periodo_movimentacao ?? "—"}
                          </strong>
                          . Envie ou aguarde a movimentação da competência atual.
                        </p>
                      </div>
                    </div>
                  )}

                  {!movsContrato || movsContrato.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 md:p-6">Nenhuma movimentação registrada.</p>
                  ) : (
                    <>
                      {/* Mobile: cards */}
                      <div className="md:hidden divide-y divide-border/60">
                        {movsContrato.map((m: any) => {
                          const status = calcularStatus(m);
                          const dataNota = notasFinanceiro?.get(`${m.mes_referencia}__${m.periodo}`) ?? null;
                          const Row = ({ label, value, icon: Icon, tone }: { label: string; value: string | null; icon: any; tone?: "warning" | "success" }) => (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
                              {value ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                                  <Icon className={cn("h-3.5 w-3.5", tone === "success" ? "text-success" : "text-warning")} />
                                  {value}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <Clock className="h-3.5 w-3.5" /> Pendente
                                </span>
                              )}
                            </div>
                          );
                          return (
                            <div key={m.id} className="p-4 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold">{formatMesReferencia(m.mes_referencia)}</div>
                                  <div className="text-[11px] text-muted-foreground">Período {m.periodo}</div>
                                </div>
                                <Badge className={cn("text-[10px] font-medium border shrink-0", statusColor(status))}>
                                  {status}
                                </Badge>
                              </div>
                              <div className="space-y-1.5 pt-1">
                                <Row label="Enviado p/ empresa" value={m.data_envio_empresa ? fmtDate(m.data_envio_empresa) : null} icon={CheckCircle2} tone="warning" />
                                <Row label="Enviado ao financeiro" value={m.data_envio_financeiro ? fmtDate(m.data_envio_financeiro) : null} icon={CheckCircle2} tone="success" />
                                <Row label="Nota emitida" value={dataNota ? fmtDate(dataNota) : null} icon={CheckCircle2} tone="success" />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop: table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Competência</th>
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Período</th>
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Enviado p/ empresa</th>
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Enviado ao financeiro</th>
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Nota emitida</th>
                              <th className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/60">
                            {movsContrato.map((m: any) => {
                              const status = calcularStatus(m);
                              const dataNota = notasFinanceiro?.get(`${m.mes_referencia}__${m.periodo}`) ?? null;
                              return (
                                <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-6 py-4 text-sm font-medium">{formatMesReferencia(m.mes_referencia)}</td>
                                  <td className="px-6 py-4 text-sm text-muted-foreground">{m.periodo}</td>
                                  <td className="px-6 py-4 text-sm">
                                    {m.data_envio_empresa ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-warning" />
                                        {fmtDate(m.data_envio_empresa)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5" /> Pendente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-sm">
                                    {m.data_envio_financeiro ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                        {fmtDate(m.data_envio_financeiro)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5" /> Pendente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-sm">
                                    {dataNota ? (
                                      <span className="inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                        {fmtDate(dataNota)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                        <Clock className="h-3.5 w-3.5" /> Pendente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-sm">
                                    <Badge className={cn("text-[10px] font-medium border", statusColor(status))}>
                                      {status}
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>

              );
            })()}
          </div>

          {/* Right column: Responsáveis + Atendimento */}
          <div className="space-y-4 md:space-y-6">
            {secoes.contrato && (
              <section className="rounded-xl border border-border bg-card p-4 md:p-6">
                <h2 className="text-xs md:text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 md:mb-6 flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Responsáveis
                </h2>

                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary text-sm">
                      {initials((empresa as any)?.responsavel_contrato)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{(empresa as any)?.responsavel_contrato ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Responsável pelo Contrato</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center font-bold text-muted-foreground text-sm">
                      {initials((empresa as any)?.executiva_nome)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{(empresa as any)?.executiva_nome ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Executiva Responsável</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {secoes.chat && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <ChatAtendimento />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
