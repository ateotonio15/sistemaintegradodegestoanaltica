import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Building2, FileText, CalendarClock, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmtMoney(v: number | null | undefined) {
  if (v == null) return "-";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  try { return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR }); } catch { return v; }
}

type EstadoMov =
  | { tipo: "empresa"; ate: string | null }
  | { tipo: "financeiro" }
  | { tipo: "fechado"; proxima: string | null }
  | { tipo: "sem_periodo" };

function calcularEstado(mov: any | null): EstadoMov {
  if (!mov) return { tipo: "sem_periodo" };
  // Aberto para a empresa se enviado à empresa e ainda não retornou/enviado ao financeiro
  if (mov.data_envio_empresa && !mov.data_retorno_empresa && !mov.data_envio_financeiro) {
    return { tipo: "empresa", ate: mov.data_retorno_empresa ?? null };
  }
  // Em análise financeira: enviado ao financeiro (ou retornado sem próxima janela)
  if (mov.data_envio_financeiro) {
    return { tipo: "financeiro" };
  }
  if (mov.data_retorno_empresa && !mov.data_envio_financeiro) {
    return { tipo: "financeiro" };
  }
  return { tipo: "fechado", proxima: null };
}

export default function Portal() {
  const { user, empresaVinculadaId, signOut } = useAuth();

  const { data: empresa } = useQuery({
    queryKey: ["portal", "empresa", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("id, nome, cnpj, status_empresa, data_implantacao, dia_movimentacao, data_corte")
        .eq("id", empresaVinculadaId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: contrato } = useQuery({
    queryKey: ["portal", "contrato", empresaVinculadaId],
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

  const { data: movimentacoes } = useQuery({
    queryKey: ["portal", "movs", empresaVinculadaId],
    enabled: !!empresaVinculadaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("id, mes_referencia, periodo, data_envio_empresa, data_retorno_empresa, data_envio_financeiro, tipo_movimentacao, dentro_prazo")
        .eq("empresa_id", empresaVinculadaId!)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const movAtual = movimentacoes?.[0] ?? null;
  const estado = calcularEstado(movAtual);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold">{empresa?.nome ?? "Portal da empresa"}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 py-8">
        {/* Contrato */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>Contrato</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info label="Empresa" value={empresa?.nome ?? "-"} />
            <Info label="CNPJ" value={empresa?.cnpj ?? "-"} />
            <Info label="Valor mensal" value={fmtMoney(Number(contrato?.valor_mensal ?? 0))} />
            <Info label="Início" value={fmtDate(contrato?.data_inicio)} />
            <Info label="Fim" value={fmtDate(contrato?.data_fim)} />
            <Info label="Status" value={<Badge variant={contrato?.status === "ativo" ? "default" : "secondary"}>{contrato?.status ?? "-"}</Badge>} />
          </CardContent>
        </Card>

        {/* Período de movimentação */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle>Período de movimentação</CardTitle>
          </CardHeader>
          <CardContent>
            {estado.tipo === "empresa" && (
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-medium text-emerald-700 dark:text-emerald-400">Movimentação liberada</div>
                  <p className="text-sm text-muted-foreground">
                    O período <strong>{movAtual?.periodo ?? movAtual?.mes_referencia}</strong> está aberto para envio de inclusões e exclusões.
                  </p>
                </div>
              </div>
            )}
            {estado.tipo === "financeiro" && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <Clock className="mt-0.5 h-5 w-5 text-amber-600" />
                <div>
                  <div className="font-medium text-amber-700 dark:text-amber-400">Aguardando emissão da nota</div>
                  <p className="text-sm text-muted-foreground">
                    A movimentação do período <strong>{movAtual?.periodo ?? movAtual?.mes_referencia}</strong> está com o financeiro para
                    emissão da nota fiscal. Enquanto isso, novas movimentações estão bloqueadas. Assim que a nota for emitida, o contrato será
                    liberado para movimentar novamente.
                  </p>
                </div>
              </div>
            )}
            {estado.tipo === "fechado" && (
              <div className="flex items-start gap-3 rounded-lg border border-muted-foreground/30 bg-muted/40 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">Movimentação encerrada</div>
                  <p className="text-sm text-muted-foreground">
                    Este contrato não pode receber movimentações no momento. A próxima janela abrirá
                    {empresa?.dia_movimentacao ? <> a partir do dia <strong>{empresa.dia_movimentacao}</strong> do próximo mês.</> : <> no próximo ciclo.</>}
                  </p>
                </div>
              </div>
            )}
            {estado.tipo === "sem_periodo" && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhum período de movimentação registrado ainda para esta empresa.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Histórico */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas movimentações</CardTitle>
          </CardHeader>
          <CardContent>
            {!movimentacoes || movimentacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentações registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 pr-4">Competência</th>
                      <th className="py-2 pr-4">Período</th>
                      <th className="py-2 pr-4">Envio empresa</th>
                      <th className="py-2 pr-4">Retorno empresa</th>
                      <th className="py-2 pr-4">Envio financeiro</th>
                      <th className="py-2 pr-4">Prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimentacoes.map((m: any) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{m.mes_referencia}</td>
                        <td className="py-2 pr-4">{m.periodo ?? "-"}</td>
                        <td className="py-2 pr-4">{fmtDate(m.data_envio_empresa)}</td>
                        <td className="py-2 pr-4">{fmtDate(m.data_retorno_empresa)}</td>
                        <td className="py-2 pr-4">{fmtDate(m.data_envio_financeiro)}</td>
                        <td className="py-2 pr-4">
                          {m.dentro_prazo === false ? (
                            <Badge variant="destructive">Fora do prazo</Badge>
                          ) : m.dentro_prazo === true ? (
                            <Badge variant="default">No prazo</Badge>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
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
