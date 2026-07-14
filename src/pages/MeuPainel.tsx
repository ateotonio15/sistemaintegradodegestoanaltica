import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Building2, FileText, Users, Wallet, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChatAtendimento } from "@/components/portal/ChatAtendimento";

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
        .select("id, nome, cnpj, status_empresa, portal_secoes, tipo_movimentacao, periodo_movimentacao, data_implantacao, data_corte, dia_movimentacao, prazo, responsavel_contrato, executiva_user_id")
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

  const { data: movsFinanceiras } = useQuery({
    queryKey: ["meu-painel", "movs-fin", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacao_financeira")
        .select("id, tipo, valor, descricao, data")
        .eq("empresa_id", empresaVinculadaId!)
        .order("data", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data ?? [];
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
                  <div className="text-3xl font-bold">{vidasAtivas ?? "-"}</div>
                  <p className="text-xs text-muted-foreground">Beneficiários com status ativo</p>
                </CardContent>
              </Card>
            )}

            {secoes.contrato && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Valor mensal</CardTitle>
                    <Wallet className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{fmtMoney(Number(contrato?.valor_mensal ?? 0))}</div>
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
              <Info label="Valor mensal" value={fmtMoney(Number(contrato?.valor_mensal ?? 0))} />
              <Info label="Status" value={contrato?.status ?? "-"} />
              <Info label="Início da vigência" value={fmtDate((empresa as any)?.data_implantacao)} />
              <Info label="Fim da vigência" value={fmtDate(contrato?.data_fim) === "-" ? "Sem prazo definido" : fmtDate(contrato?.data_fim)} />

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
              <Info label="Data de Corte" value={fmtDate((empresa as any)?.data_corte)} />
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

        {secoes.movimentacoes && (
          <Card>
            <CardHeader>
              <CardTitle>Últimas movimentações financeiras</CardTitle>
            </CardHeader>
            <CardContent>
              {!movsFinanceiras || movsFinanceiras.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma movimentação financeira registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground">
                      <tr className="border-b">
                        <th className="py-2 pr-4">Data</th>
                        <th className="py-2 pr-4">Tipo</th>
                        <th className="py-2 pr-4">Descrição</th>
                        <th className="py-2 pr-4 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movsFinanceiras.map((m: any) => {
                        const entrada = m.tipo === "entrada";
                        return (
                          <tr key={m.id} className="border-b last:border-0">
                            <td className="py-2 pr-4">{fmtDate(m.data)}</td>
                            <td className="py-2 pr-4">
                              <span className={entrada ? "inline-flex items-center gap-1 text-emerald-600" : "inline-flex items-center gap-1 text-rose-600"}>
                                {entrada ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                {entrada ? "Entrada" : "Saída"}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">{m.descricao ?? "-"}</td>
                            <td className={`py-2 pr-4 text-right font-medium ${entrada ? "text-emerald-600" : "text-rose-600"}`}>
                              {entrada ? "+" : "-"} {fmtMoney(Number(m.valor ?? 0))}
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
        )}
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
