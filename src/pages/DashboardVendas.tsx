import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { FileSignature, Plus, Send, AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, Search, ChevronRight, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ImplantacaoWizard } from "@/components/implantacao/ImplantacaoWizard";
import { STATUS_META, STATUS_ORDER } from "@/lib/implantacao-status";
import { formatDateBR, formatDay } from "@/lib/date-utils";

export default function DashboardVendas() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["implantacoes-vendas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacoes_contratos" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ["impl-alertas", "vendas", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("implantacao_alertas" as any)
        .select("*")
        .eq("destinatario_role", "vendas")
        .eq("destinatario_user_id", user!.id)
        .eq("status", "Pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user?.id,
  });

  const now = new Date();
  const mesAtual = now.getMonth();
  const anoAtual = now.getFullYear();

  const isImplantadoNoMes = (i: any) => {
    if (i.status !== "implantado" || !i.implantado_em) return false;
    const d = new Date(i.implantado_em);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  };

  const emAndamento = useMemo(
    () =>
      items.filter(
        (i) =>
          (i.status !== "implantado" && i.status !== "rejeitado") ||
          isImplantadoNoMes(i)
      ),
    [items, mesAtual, anoAtual]
  );

  const filtered = useMemo(() => {
    if (!search) return emAndamento;
    const s = search.toLowerCase();
    return emAndamento.filter((i) =>
      (i.nome_empresa || "").toLowerCase().includes(s) ||
      (i.cnpj || "").toLowerCase().includes(s) ||
      (i.codigo_contrato || "").toLowerCase().includes(s)
    );
  }, [emAndamento, search]);


  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    items.forEach((i) => { c[i.status] = (c[i.status] || 0) + 1; });
    return c;
  }, [items]);

  const totalVidas = useMemo(
    () => items.filter(isImplantadoNoMes).reduce((acc, i) => acc + (i.total_vidas || 0), 0),
    [items, mesAtual, anoAtual]
  );

  const implantadosMes = items.filter(isImplantadoNoMes).length;

  const handleNew = async () => {
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user!.id).maybeSingle();
    const { data, error } = await supabase
      .from("implantacoes_contratos" as any)
      .insert({ status: "em_implantacao", etapa_atual: 1, created_by: user!.id, created_by_nome: prof?.display_name } as any)
      .select().single();
    if (error) return;
    qc.invalidateQueries({ queryKey: ["implantacoes-vendas"] });
    setOpenId((data as any).id);
  };

  return (
    <>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <FileSignature className="h-7 w-7 text-primary" /> Painel de Vendas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Controle das suas implantações contratuais.</p>
          </div>
          <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" /> Nova Implantação</Button>
        </div>

        {/* Alertas */}
        {alertas.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                <AlertTriangle className="h-4 w-4" /> Pendências da Diretoria ({alertas.length})
              </div>
              {alertas.slice(0, 3).map((a) => {
                const impl = items.find((i) => i.id === a.implantacao_id);
                return (
                  <button key={a.id} onClick={() => impl && setOpenId(impl.id)} className="w-full text-left p-2 rounded-lg hover:bg-amber-500/10 transition-colors text-sm">
                    <p className="font-medium">{a.empresa_nome}</p>
                    <p className="text-xs text-muted-foreground">{a.mensagem}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<FileSignature />} label="Em implantação" value={(counts.em_implantacao || 0) + (counts.documentacao_pendente || 0)} accent="text-primary" />
          <Kpi icon={<Send />} label="Aguardando Diretoria" value={counts.em_analise_diretoria || 0} accent="text-blue-500" />
          <Kpi icon={<AlertTriangle />} label="Necessita correção" value={counts.necessita_correcao || 0} accent="text-amber-500" />
          <Kpi icon={<CheckCircle2 />} label="Aprovados" value={(counts.aprovado_diretoria || 0) + (counts.enviado_cadastro || 0)} accent="text-emerald-500" />
          <Kpi icon={<CheckCircle2 />} label="Implantados" value={counts.implantado || 0} accent="text-emerald-600" />
          <Kpi icon={<TrendingUp />} label="Implantados no mês" value={implantadosMes} accent="text-emerald-600" />
          <Kpi icon={<Users />} label="Vidas totais" value={totalVidas} accent="text-primary" />
          <Kpi icon={<XCircle />} label="Rejeitados" value={counts.rejeitado || 0} accent="text-red-500" />
        </div>

        {/* Lista */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> Implantações em andamento</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-8 h-9" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhuma implantação ainda. Clique em "Nova Implantação" para começar.</p>
            ) : (
              <ul className="divide-y">
                {filtered.map((i) => {
                  const meta = STATUS_META[i.status] || STATUS_META.em_implantacao;
                  return (
                    <li key={i.id}>
                      <button onClick={() => setOpenId(i.id)} className="w-full text-left p-4 hover:bg-accent/40 transition-colors flex items-center gap-3 group">
                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-white shadow-sm`}>
                          <FileSignature className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold truncate">{i.nome_empresa || "Sem nome"}</p>
                            <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
                            {i.codigo_contrato && (
                              <Badge variant="secondary" className="text-[10px]">#{i.codigo_contrato}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                            {i.cnpj && <span>CNPJ: {i.cnpj}</span>}
                            <span>{i.total_vidas || 0} vidas</span>
                            {i.modalidade && <span>· {i.modalidade}</span>}
                            {i.acomodacao && <span>· {i.acomodacao}</span>}
                            {i.data_vigencia && <span>· Vigência {formatDateBR(i.data_vigencia)}</span>}
                            {i.data_vencimento && <span>· Venc. dia {formatDay(i.data_vencimento)}</span>}
                            {i.corretora && <span>· {i.corretora}</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Criado por {i.created_by_nome || "—"} em {formatDateBR(i.created_at)}
                            {i.motivo_correcao && (
                              <span className="text-amber-600"> · Correção: {i.motivo_correcao}</span>
                            )}
                          </div>
                          <Progress value={i.progresso || 0} className="h-1.5 mt-2" />
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>

      {openId && (
        <ImplantacaoWizard
          id={openId}
          open={!!openId}
          onClose={() => { setOpenId(null); qc.invalidateQueries({ queryKey: ["implantacoes-vendas"] }); }}
          readOnly={false}
        />
      )}
    </>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={accent}>{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <p className="text-2xl font-bold mt-1.5">{value}</p>
      </CardContent>
    </Card>
  );
}
