import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Building2, FileText, Users, Wallet, CalendarClock, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
  const { user, empresaVinculadaId, signOut } = useAuth();

  const { data: empresa } = useQuery({
    queryKey: ["meu-painel", "empresa", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, status_empresa, portal_secoes, tipo_movimentacao, periodo_movimentacao, data_implantacao, data_corte, dia_movimentacao, prazo, responsavel_contrato, executiva_user_id, valor_enfermaria_centavos, valor_apartamento_centavos, vidas")
        .eq("id", empresaVinculadaId!)
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
    queryKey: ["meu-painel", "contrato", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("valor_mensal, data_inicio, data_fim, status")
        .eq("empresa_id", empresaVinculadaId!)
        .order("data_inicio", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: vidasAtivas } = useQuery({
    queryKey: ["meu-painel", "vidas", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vidas_ativas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaVinculadaId!)
        .eq("status", "ativo");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: movsContrato } = useQuery({
    queryKey: ["meu-painel", "movs-contrato", empresaVinculadaId, "v2-2026-05"],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, mes_referencia, periodo, data_envio_empresa, data_envio_financeiro, created_at")
        .eq("empresa_id", empresaVinculadaId!)
        .gte("mes_referencia", "2026-05")
        .order("mes_referencia", { ascending: false })
        .order("periodo", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notasFinanceiro } = useQuery({
    queryKey: ["meu-painel", "notas-financeiro", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro_movimentacoes")
        .select("mes_referencia, periodo, data_envio_nota")
        .eq("empresa_id", empresaVinculadaId!)
        .not("data_envio_nota", "is", null);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((f: any) => {
        map.set(`${f.mes_referencia}__${f.periodo}`, f.data_envio_nota);
      });
      return map;
    },
  });



  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">{empresa?.nome ?? "Meu Painel"}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 py-8">
        <h1 className="text-2xl font-bold">Meu Painel</h1>

        {(secoes.vidas || secoes.contrato) && (
          <div className="grid gap-4 md:grid-cols-3">
            {secoes.vidas && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Vidas ativas</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{(empresa as any)?.vidas ?? "-"}</div>
                  <p className="text-xs text-muted-foreground">Beneficiários com status ativo</p>
                </CardContent>
              </Card>
            )}

            {secoes.contrato && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Valor mensal de Enfermaria</CardTitle>
                    <Wallet className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{fmtMoney(((empresa as any)?.valor_enfermaria_centavos ?? 0) / 100)}</div>
                    <p className="text-xs text-muted-foreground">Contrato vigente</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Status do contrato</CardTitle>
                    <FileText className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold capitalize">
                      <Badge variant={contrato?.status === "ativo" ? "default" : "secondary"} className="text-base">
                        {contrato?.status ?? "-"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Vigência: {fmtDate(contrato?.data_inicio)} → {fmtDate(contrato?.data_fim) === "-" ? "sem prazo" : fmtDate(contrato?.data_fim)}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {secoes.contrato && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Resumo do contrato</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label="Empresa" value={empresa?.nome ?? "-"} />
              <Info label="CNPJ" value={empresa?.cnpj ?? "-"} />
              <Info label="Valor mensal de Enfermaria" value={fmtMoney(((empresa as any)?.valor_enfermaria_centavos ?? 0) / 100)} />
              <Info
                label="Valor mensal de Apartamento"
                value={fmtMoney(
                  Number(contrato?.valor_mensal ?? 0) > 0
                    ? Number(contrato.valor_mensal)
                    : ((empresa as any)?.valor_apartamento_centavos ?? 0) / 100
                )}
              />
              <Info label="Status" value={(empresa as any)?.status_empresa ?? "-"} />
              <Info label="Início da vigência" value={(() => {
                const emp: any = empresa;
                if (!emp) return "-";
                let dia: number | null = null;
                if (emp.periodo_movimentacao) {
                  dia = Number(emp.periodo_movimentacao.split("-")[0]);
                } else if (emp.data_corte) {
                  const d = Number(emp.data_corte);
                  dia = d <= 5 ? 1 : d <= 10 ? 5 : d <= 15 ? 10 : d <= 20 ? 15 : d <= 25 ? 20 : 25;
                }
                if (!dia) return "-";
                const now = new Date();
                return `${String(dia).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
              })()} />



              <Info label="Fim da vigência" value={(() => {
                const emp: any = empresa;
                if (!emp) return "-";
                let dia: number | null = null;
                if (emp.periodo_movimentacao) {
                  dia = Number(emp.periodo_movimentacao.split("-")[1]);
                } else if (emp.data_corte) {
                  dia = Number(emp.data_corte);
                }
                if (!dia) return "-";
                const now = new Date();
                return `${String(dia).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
              })()} />

              <Info label="Tipo de Movimentação" value={(empresa as any)?.tipo_movimentacao ?? "-"} />
              <Info
                label="Período de Movimentação"
                value={
                  (empresa as any)?.tipo_movimentacao === "Diária"
                    ? `Diária (corte dia ${(empresa as any)?.data_corte ? fmtDate((empresa as any).data_corte) : "-"})`
                    : ((empresa as any)?.periodo_movimentacao ?? "-")
                }
              />
              <Info label="Data de Implantação" value={fmtDate((empresa as any)?.data_implantacao)} />
              {(empresa as any)?.tipo_movimentacao === "Diária" && (
                <Info label="Data de Corte" value={(() => {
                  const emp: any = empresa;
                  let dia: number | null = null;
                  if (emp?.periodo_movimentacao) dia = Number(emp.periodo_movimentacao.split("-")[1]);
                  else if (emp?.data_corte) dia = Number(emp.data_corte);
                  return dia ? String(dia).padStart(2, "0") : "-";
                })()} />
              )}
              <Info label="Prazo (sem carência)" value={(empresa as any)?.prazo ?? "-"} />
            </CardContent>
          </Card>
        )}

        {secoes.contrato && (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle>Responsáveis</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Info label="Responsável pelo Contrato" value={(empresa as any)?.responsavel_contrato ?? "-"} />
              <Info label="Executiva Responsável" value={(empresa as any)?.executiva_nome ?? "-"} />
            </CardContent>
          </Card>
        )}

        {secoes.chat && <ChatAtendimento />}

        {secoes.movimentacoes && (() => {
          const noPeriodo = empresa ? contratoDentroDoPeriodo(empresa as any) : false;
          return (
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <CardTitle>Movimentações do contrato</CardTitle>
                  <p className="text-xs text-muted-foreground">Envios do cadastro e do financeiro, por competência.</p>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {noPeriodo && (
                  <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">Contrato dentro do período de movimentação</p>
                      <p className="text-muted-foreground text-xs">
                        Este contrato está no período{" "}
                        <strong>
                          {(empresa as any)?.tipo_movimentacao === "Diária"
                            ? `corte dia ${(empresa as any)?.data_corte ?? "-"}`
                            : (empresa as any)?.periodo_movimentacao ?? "-"}
                        </strong>
                        . Envie ou aguarde a movimentação da competência atual.
                      </p>
                    </div>
                  </div>
                )}

                {!movsContrato || movsContrato.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-4">Competência</th>
                          <th className="py-2 pr-4">Período</th>
                          <th className="py-2 pr-4">Enviado p/ empresa</th>
                          <th className="py-2 pr-4">Enviado ao financeiro</th>
                          <th className="py-2 pr-4">Nota emitida</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movsContrato.map((m: any) => {
                          const status = calcularStatus(m);
                          const dataNota = notasFinanceiro?.get(`${m.mes_referencia}__${m.periodo}`) ?? null;
                          return (
                            <tr key={m.id} className="border-b last:border-0">
                              <td className="py-2 pr-4 font-medium">{formatMesReferencia(m.mes_referencia)}</td>
                              <td className="py-2 pr-4">{m.periodo}</td>
                              <td className="py-2 pr-4">
                                {m.data_envio_empresa ? (
                                  <span className="inline-flex items-center gap-1 text-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-warning" />
                                    {fmtDate(m.data_envio_empresa)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" /> Pendente
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                {m.data_envio_financeiro ? (
                                  <span className="inline-flex items-center gap-1 text-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                    {fmtDate(m.data_envio_financeiro)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" /> Pendente
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                {dataNota ? (
                                  <span className="inline-flex items-center gap-1 text-foreground">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                    {fmtDate(dataNota)}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3.5 w-3.5" /> Pendente
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-4">
                                <Badge className={cn("text-xs", statusColor(status))}>{status}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
      </main>

    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
