import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { IsoDatePicker } from "@/components/ui/iso-date-picker";
import { FileSignature, Plus, Send, AlertTriangle, CheckCircle2, Clock, Users, TrendingUp, Search, ChevronRight, XCircle, ClipboardCheck, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ImplantacaoWizard } from "@/components/implantacao/ImplantacaoWizard";
import { STATUS_META } from "@/lib/implantacao-status";
import { formatDateBR, formatDay } from "@/lib/date-utils";

function isSameLocalDay(iso: string | null | undefined, ref: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

function parseISODateLocal(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function ReguaImplantacao({ item }: { item: any }) {
  const etapas = [
    { label: "Criação", data: item.created_at },
    { label: "Diretoria", data: item.enviado_diretoria_em },
    { label: "Cadastro", data: item.enviado_cadastro_em },
    { label: "Implantado", data: item.implantado_em },
  ];

  return (
    <div className="flex items-center gap-1 mt-3" aria-label="Régua da implantação">
      {etapas.map((etapa, index) => {
        const concluida = Boolean(etapa.data);
        return (
          <div key={etapa.label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-[58px]">
              <span
                className={`h-2.5 w-2.5 rounded-full border-2 ${
                  concluida ? "bg-primary border-primary" : "bg-background border-muted-foreground/30"
                }`}
                title={etapa.data ? `${etapa.label}: ${formatDateBR(etapa.data)}` : etapa.label}
              />
              <span className={`text-[10px] ${concluida ? "text-foreground" : "text-muted-foreground"}`}>
                {etapa.label}
              </span>
            </div>
            {index < etapas.length - 1 && (
              <span className={`h-0.5 flex-1 ${concluida ? "bg-primary/60" : "bg-muted-foreground/20"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardVendas() {
  const { user, isVendas } = useAuth();
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dataInicio, setDataInicio] = useState<string | null>(null);
  const [dataFim, setDataFim] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile-nome", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, username").eq("user_id", user!.id).maybeSingle();
      return data as any;
    },
    enabled: !!user?.id,
  });

  const { data: items = [], dataUpdatedAt } = useQuery({
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

  // Base filtrada pelo período (created_at). Sem filtro = período atual (mês corrente) + itens em aberto.
  const base = useMemo(() => {
    if (dataInicio || dataFim) {
      const ini = dataInicio ? parseISODateLocal(dataInicio) : null;
      const fim = dataFim ? (() => { const d = parseISODateLocal(dataFim); d.setHours(23, 59, 59, 999); return d; })() : null;
      return items.filter((i) => {
        const d = new Date(i.created_at);
        if (ini && d < ini) return false;
        if (fim && d > fim) return false;
        return true;
      });
    }
    return items;
  }, [items, dataInicio, dataFim]);

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

  // ===== KPIs do novo painel =====
  const kpis = useMemo(() => {
    const preAprovadas = base.filter((i) => i.status === "aprovado_diretoria" || i.status === "enviado_cadastro").length;
    const liberadasHoje = base.filter((i) => isSameLocalDay(i.implantado_em, now) || (i.status === "enviado_cadastro" && isSameLocalDay(i.updated_at, now))).length;
    const devolvidas = base.filter((i) => i.status === "necessita_correcao").length;

    const tempos = base
      .filter((i) => (i.status === "aprovado_diretoria" || i.status === "enviado_cadastro" || i.status === "implantado") && i.created_at)
      .map((i) => {
        const ini = new Date(i.created_at).getTime();
        const fim = new Date(i.updated_at || i.implantado_em || i.created_at).getTime();
        return Math.max(0, (fim - ini) / 3600000);
      });
    const mediaHoras = tempos.length ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;
    const tempoMedio = mediaHoras >= 48 ? `${Math.round(mediaHoras / 24)}d` : `${Math.round(mediaHoras)}h`;

    return { preAprovadas, liberadasHoje, devolvidas, tempoMedio };
  }, [base]);

  const totalVidas = useMemo(
    () => items.filter(isImplantadoNoMes).reduce((acc, i) => acc + (i.total_vidas || 0), 0),
    [items, mesAtual, anoAtual]
  );

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

  const primeiroNome = (profile?.display_name || profile?.username || "Vendedor").split(" ")[0];
  const atualizadoEm = new Date(dataUpdatedAt || Date.now());
  const atualizadoEmLabel = `${atualizadoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <>
      <div className="p-4 md:p-6 space-y-5">
        {/* Cabeçalho estilo da referência */}
        <div className="space-y-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3 flex-wrap">
              Olá, {primeiroNome}
              <Badge variant="secondary" className="text-xs font-medium px-3 py-1 rounded-full">Vendas</Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Última atualização: <span className="font-medium text-foreground">{atualizadoEmLabel}</span>
            </p>
          </div>
          <Button onClick={handleNew} className="gap-2 rounded-xl px-5 font-semibold">
            <Plus className="h-4 w-4" /> Nova Implantação
          </Button>
        </div>

        {/* Filtro de período */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-full sm:w-56">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Data de Início</p>
                <IsoDatePicker value={dataInicio} onChange={setDataInicio} placeholder="Selecionar data" />
              </div>
              <div className="w-full sm:w-56">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Data de Fim</p>
                <IsoDatePicker value={dataFim} onChange={setDataFim} placeholder="Selecionar data" />
              </div>
              {(dataInicio || dataFim) && (
                <Button variant="ghost" size="sm" onClick={() => { setDataInicio(null); setDataFim(null); }} className="text-muted-foreground">
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alertas */}
        {alertas.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-500/5 rounded-2xl">
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

        {/* KPIs principais — padrão da imagem */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard icon={<ClipboardCheck className="h-5 w-5" />} label="Pré-aprovações (fila)" value={String(kpis.preAprovadas)} />
          <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label="Liberadas hoje" value={String(kpis.liberadasHoje)} />
          <KpiCard icon={<RotateCcw className="h-5 w-5" />} label="Devolvidas" value={String(kpis.devolvidas)} />
          <KpiCard icon={<Clock className="h-5 w-5" />} label="Tempo médio na fila" value={kpis.tempoMedio} />
        </div>

        {/* KPIs secundários */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi icon={<Send />} label="Aguardando Diretoria" value={items.filter((i) => i.status === "em_analise_diretoria").length} accent="text-blue-500" />
          <Kpi icon={<CheckCircle2 />} label="Implantados" value={items.filter((i) => i.status === "implantado").length} accent="text-emerald-600" />
          <Kpi icon={<Users />} label="Vidas no mês" value={totalVidas} accent="text-primary" />
          <Kpi icon={<XCircle />} label="Rejeitados" value={items.filter((i) => i.status === "rejeitado").length} accent="text-red-500" />
        </div>

        {/* Lista */}
        <Card className="rounded-2xl">
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
                            <span>{i.total_vidas || 0} vidas ativas</span>
                            {i.modalidade && <span>· {i.modalidade}</span>}
                            {i.acomodacao && <span>· {i.acomodacao}</span>}
                            {i.inicio_atendimento && <span>· Movimentação: {formatDateBR(i.inicio_atendimento)}</span>}
                            {i.data_vigencia && <span>· Vigência: dia {formatDay(i.data_vigencia)}</span>}
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
                           {isVendas && <ReguaImplantacao item={i} />}
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

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-border/60 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <span className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</span>
        </div>
        <p className="text-4xl font-bold mt-3">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">Período atual</p>
      </CardContent>
    </Card>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <Card className="card-hover rounded-2xl">
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
