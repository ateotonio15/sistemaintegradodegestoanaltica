import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Presentation as PresentationIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useDashboardExecutivo } from "../hooks/useDashboardExecutivo";
import { KpiGrid, countHiddenKpis } from "../components/executive/KpiGrid";
import { CampanhaBarChart } from "../components/executive/CampanhaBarChart";
import { EngajamentoDonut } from "../components/executive/EngajamentoDonut";
import { TopEmpresasChart } from "../components/executive/TopEmpresasChart";
import { TriagemPanel } from "../components/executive/TriagemPanel";
import { OutubroRosaModule } from "../components/executive/OutubroRosaModule";
import { NovembroAzulModule } from "../components/executive/NovembroAzulModule";
import { SimuladorMesButton } from "../components/executive/SimuladorMesButton";
import { ApresentacaoOverlay, type Slide } from "../components/executive/ApresentacaoOverlay";
import { exportExecutivePdf } from "../lib/exec-export-pdf";
import { MESES_PT } from "../lib/palestras-calendario";
import { OUTUBRO_ROSA, NOVEMBRO_AZUL } from "../lib/exec-mock-julho-2026";

export default function DashboardExecutivo() {
  const now = new Date();
  const [searchParams] = useSearchParams();
  const devMode = searchParams.get("dev") === "1";
  const [mes, setMes] = useState<number>(7);
  const [ano, setAno] = useState<number>(2026);
  const [forcedMes, setForcedMes] = useState<number | null>(null);
  const [showPresentation, setShowPresentation] = useState(false);

  const { data, isLoading } = useDashboardExecutivo({ mes, ano });

  const mesExibido = forcedMes ?? mes;
  // Ativação condicional: só carrega quando é o mês real E há registros ativos
  const outubroTemDados = OUTUBRO_ROSA.mamografiasRealizadas > 0 || OUTUBRO_ROSA.mamografiasAgendadas > 0;
  const novembroTemPsa = NOVEMBRO_AZUL.psaRealizados > 0;
  const showOutubro = (mesExibido === 10) && (forcedMes === 10 || outubroTemDados);
  const showNovembro = (mesExibido === 11) && (forcedMes === 11 || novembroTemPsa);

  // Filtragem de valores zerados em gráficos
  const campanhasFiltradas = useMemo(() => (data?.campanhas ?? []).filter((c) => c.valor > 0), [data]);
  const engajamentoFiltrado = useMemo(() => (data?.engajamento ?? []).filter((e) => e.valor > 0), [data]);
  const topEmpresasFiltradas = useMemo(() => (data?.topEmpresas ?? []).filter((e) => e.acoes > 0), [data]);
  const hiddenKpis = data ? countHiddenKpis(data.kpis) : 0;
  const hiddenCampanhas = (data?.campanhas.length ?? 0) - campanhasFiltradas.length;
  const hasHidden = hiddenKpis + hiddenCampanhas > 0;


  const anos = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 2 + i);

  const handlePdf = () => {
    if (!data) return;
    try {
      exportExecutivePdf({
        mes, ano,
        kpis: data.kpis,
        campanhas: data.campanhas,
        topEmpresas: data.topEmpresas,
        triagem: data.triagemAgg,
        campanhaEspecial: showOutubro ? "outubro-rosa" : showNovembro ? "novembro-azul" : null,
      });
      toast.success("Relatório PDF gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar PDF");
    }
  };

  const slides: Slide[] = useMemo(() => {
    if (!data) return [];
    const base: Slide[] = [
      {
        title: "Saúde nas Empresas",
        subtitle: `${MESES_PT[mes - 1]} · ${ano} — Panorama Executivo`,
        bg: "dark",
        render: () => (
          <div className="grid grid-cols-2 gap-8 pt-4">
            {[
              { l: "Total de Ações", v: data.kpis.totalAcoes },
              { l: "Empresas Atendidas", v: data.kpis.empresasAtendidas },
              { l: "Palestras", v: data.kpis.palestras },
              { l: "Sinais Vitais", v: data.kpis.sinaisVitais },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-emerald-200/70">{k.l}</p>
                <p className="mt-3 font-serif text-7xl font-semibold">{k.v}</p>
              </div>
            ))}
          </div>
        ),
      },
      { title: "Distribuição por Campanha", subtitle: "Ações executadas no mês", render: () => <div className="max-w-4xl"><CampanhaBarChart data={campanhasFiltradas} /></div> },
      { title: "Engajamento do Mês", subtitle: "Sinais Vitais vs Palestras", render: () => <div className="max-w-2xl mx-auto"><EngajamentoDonut data={engajamentoFiltrado} /></div> },
      { title: "Top Empresas", subtitle: "Ranking por ações realizadas", render: () => <div className="max-w-4xl"><TopEmpresasChart data={topEmpresasFiltradas} /></div> },
      { title: "Sinais Vitais & Triagem", subtitle: "Alterações clínicas por empresa", render: () => <TriagemPanel data={data.triagemAgg} /> },
    ];
    if (showOutubro) base.push({ title: "Outubro Rosa", subtitle: "Prevenção ao câncer de mama", render: () => <OutubroRosaModule /> });
    if (showNovembro) base.push({ title: "Novembro Azul", subtitle: "Prevenção ao câncer de próstata", render: () => <NovembroAzulModule /> });
    base.push({
      title: "Obrigado", subtitle: "Perguntas e discussão", bg: "dark",
      render: () => (
        <div className="flex h-full items-center justify-center">
          <p className="font-serif text-3xl text-emerald-100/80">Saúde é resultado. Cuidar é estratégia.</p>
        </div>
      ),
    });
    return base;
  }, [data, mes, ano, showOutubro, showNovembro]);

  return (
    <div
      className="min-h-screen"
      style={{
        // paleta executiva scoped
        // @ts-ignore
        "--exec-primary": "170 100% 15%",
        "--exec-accent": "170 71% 35%",
        "--exec-surface": "0 0% 100%",
        "--exec-border": "170 20% 88%",
      } as any}
    >
      <div className="bg-gradient-to-br from-[#f0fdf4] via-white to-[#e6f4f1]">
        {/* Header */}
        <div className="border-b border-[hsl(var(--exec-border))] bg-white/80 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto max-w-[1600px] px-6 py-4 flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/saude-empresas"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <div className="flex-1 min-w-[220px]">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#004d40]/70">Diretoria Corporativa</p>
              <h1 className="font-serif text-2xl font-semibold text-[#004d40]">Dashboard Executivo · Saúde Ocupacional</h1>
            </div>

            <div className="flex items-center gap-2">
              <Select value={String(mes)} onValueChange={(v) => { setMes(Number(v)); setForcedMes(null); }}>
                <SelectTrigger className="w-[140px] border-[#004d40]/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_PT.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                <SelectTrigger className="w-[100px] border-[#004d40]/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>

              <SimuladorMesButton forced={forcedMes} onChange={setForcedMes} />

              <Button variant="outline" className="gap-2 border-[#004d40]/30 text-[#004d40]" onClick={handlePdf} disabled={!data}>
                <FileText className="h-4 w-4" /> PDF
              </Button>
              <Button className="gap-2 bg-[#004d40] hover:bg-[#003c33]" onClick={() => setShowPresentation(true)} disabled={!data}>
                <PresentationIcon className="h-4 w-4" /> Apresentar
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1600px] px-6 py-6 space-y-6">
          {data?.usouMock && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Exibindo dados consolidados de referência (Julho/2026). Novos registros no sistema serão automaticamente incorporados.
            </div>
          )}

          {isLoading || !data ? (
            <div className="p-12 text-center text-muted-foreground">Carregando indicadores…</div>
          ) : (
            <>
              <KpiGrid kpis={data.kpis} />

              <div className="grid gap-4 lg:grid-cols-2">
                <CampanhaBarChart data={data.campanhas} />
                <EngajamentoDonut data={data.engajamento} />
              </div>

              <TopEmpresasChart data={data.topEmpresas} />

              {showOutubro && <OutubroRosaModule />}
              {showNovembro && <NovembroAzulModule />}

              <TriagemPanel data={data.triagemAgg} />
            </>
          )}
        </div>
      </div>

      {showPresentation && slides.length > 0 && (
        <ApresentacaoOverlay slides={slides} onClose={() => setShowPresentation(false)} />
      )}
    </div>
  );
}
